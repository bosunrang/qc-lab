// IPC handler cho hồ sơ NCE protocol 4 (docs/NCE-REDESIGN-2026-10-12.md).
// Nghiệp vụ (trạng thái, cổng, quyền, rerun) nằm ở `domain/nce/`; đọc/ghi
// bảng ở `db/nce-repository.ts`; đánh giá Westgard cho snapshot lần chạy ở
// `db/nce-evaluation.ts`. Tệp này chỉ ghép các bước theo khuôn
// `writeCommand()`: quyền → kiểm dữ liệu → commit (ghi + nhật ký + báo đổi).
//
// Mọi lệnh sửa một hồ sơ gửi `expectedVersion`; lệch `row_version` thì trả
// `stale` thay vì ghi đè thay đổi của người khác (sửa R-09).
import type { Db } from '../db/sqlite-like';
import type {
  NceConfigView, NceDossierView, NceQueueRowView, NceRecordRow, NceReleasePreview, NceUserOption,
} from '../../shared/qc-api';
import { cleanId, uid } from '../domain/text-utils';
import { isoLocalDate } from '../domain/local-date';
import { canWriteRole, roleOf } from '../domain/page-roles';
import type { NceDossier, NceMissing, NceRunKey, NceRunSnapshot } from '../domain/nce/types';
import { canDoNceOperation, nextNceStatus, type NceEditOperation, type NceTransition } from '../domain/nce/state';
import {
  canApproveNce, canCancelNce, canReleaseNce, canReturnNce, canSubmitNce, canWriteNce, parseNceCapabilities, type NceActorLike,
} from '../domain/nce/permissions';
import { nceApproveMissing, nceNextStep, nceReleaseMissing, nceSubmitMissing, validateNceCreate, validateNceReleaseInput } from '../domain/nce/gates';
import { checkNceRerun, nceTriggerMissing, type NceRerunResult } from '../domain/nce/rerun';
import { nceSuspectWindow, validateNcePatientImpact } from '../domain/nce/patient-impact';
import { nceCapaTriggers, nceErrorClass } from '../domain/nce/tier';
import { validateNceActionCancel, validateNceActionCompletion, validateNceActionDraft, validateNceEffectivenessReview } from '../domain/nce/actions';
import { emptyChecklist, nceFieldChanges, prepareNcePatch } from '../domain/nce/update';
import { buildNceQueue } from '../domain/nce/queue';
import { defaultNceDueDate, prepareNceConfig, type NceConfig } from '../domain/nce/config';
import { compareRun, runLabel, textLength } from '../domain/nce/format';
import { nextNceId } from '../db/nce-ids';
import {
  columnsOfPatch, editableOf, insertNceDecision, insertNceRecord, insertNceRevision, insertNceRun, listNceRows, loadNce,
  readNceConfig, recordOfRun, updateNceRecord, type NceLoaded,
} from '../db/nce-repository';
import { nceOperationalLevels, nceRejectedPoints, nceRunOutcomes, nceRunSnapshot } from '../db/nce-evaluation';
import { type Actor, type IpcResult, nowIso } from './shared';
import { writeCommand, type WriteSteps, type WriteTx } from './write-command';

const fail = <T>(code: string, message: string): IpcResult<T> => ({ ok: false, error: { code, message } });
const objectInput = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const missingText = (missing: readonly NceMissing[]) => missing.map((item) => item.message.replace(/\.$/, '')).join('; ');

function runKeyInput(value: unknown): NceRunKey | null {
  const run = objectInput(value);
  const date = String(run.date ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { date, runId: String(run.runId ?? '').trim() } : null;
}

export function createNceHandlers(db: Db) {
  const config = (): NceConfig => readNceConfig(db);

  /** Quyền NCE của người thực hiện đọc từ CSDL mỗi lần, để cấp/thu quyền có
   * hiệu lực ngay, kể cả với máy trạm LAN. */
  function actorLike(actor: Actor): NceActorLike {
    const row = db.prepare('SELECT capabilities_json FROM users WHERE id=?').get(actor.userId) as { capabilities_json: string } | undefined;
    return { userId: actor.userId, role: actor.role, capabilities: parseNceCapabilities(row?.capabilities_json) };
  }

  function load(id: string): NceLoaded | null { return loadNce(db, id, isoLocalDate(), config().recurrenceWindowDays); }

  // Đọc dữ liệu

  function view(loaded: NceLoaded, actor: Actor): NceDossierView {
    const { row, dossier } = loaded, who = actorLike(actor);
    const trigger = dossier.runs.find((run) => run.role === 'trigger')?.snapshot;
    const suspect = trigger && row.test_id ? nceSuspectWindow(nceRunOutcomes(db, row.test_id), trigger, dossier.release?.rerun ?? null) : null;
    const approval = row.status === 'pending_approval' ? canApproveNce(who, dossier, config().separationException) : null;
    const editable = row.status === 'open' || row.status === 'released';
    return {
      record: row, runs: loaded.runs, actions: loaded.actions, decisions: loaded.decisions, revisions: loaded.revisions,
      missing: nceNextStep(dossier).missing, capa_triggers: nceCapaTriggers(dossier), recurrence: dossier.recurrence,
      suspect_window: suspect ? {
        last_accepted: suspect.lastAccepted, trigger: { date: suspect.trigger.date, runId: suspect.trigger.runId },
        rerun: suspect.rerun, runs: suspect.runs,
      } : null,
      can: {
        edit: editable && canWriteNce(who).ok,
        release: row.status === 'open' && canReleaseNce(who).ok,
        submit: row.status === 'released' && canSubmitNce(who, dossier).ok,
        approve: !!approval?.ok,
        return: row.status === 'pending_approval' && canReturnNce(who).ok,
        cancel: row.status === 'open' && canCancelNce(who, dossier).ok,
        review_effectiveness: row.status === 'released' && canWriteNce(who).ok,
      },
      approve_block: approval && !approval.ok ? approval.message : '',
    };
  }

  function getNce(id: unknown, actor: Actor): NceDossierView | null {
    const loaded = load(cleanId(id));
    return loaded ? view(loaded, actor) : null;
  }

  function listNce(): NceRecordRow[] { return listNceRows(db, isoLocalDate()); }

  function listNceQueue(): NceQueueRowView[] {
    const records = db.prepare('SELECT id, nce_id, status, test_id FROM nce_records WHERE test_id IS NOT NULL').all() as { id: string; nce_id: string; status: NceDossier['status']; test_id: string }[];
    const runs = db.prepare("SELECT nce_record_id, date, run_id FROM nce_runs WHERE role<>'rerun'").all() as { nce_record_id: string; date: string; run_id: string }[];
    const runsByRecord = new Map<string, NceRunKey[]>();
    for (const run of runs) runsByRecord.set(run.nce_record_id, [...(runsByRecord.get(run.nce_record_id) ?? []), { date: run.date, runId: run.run_id }]);
    const names = new Map((db.prepare('SELECT id, name FROM tests').all() as { id: string; name: string }[]).map((t) => [t.id, t.name]));
    return buildNceQueue(nceRejectedPoints(db), records.map((r) => ({ id: r.id, nceId: r.nce_id, status: r.status, testId: r.test_id, runs: runsByRecord.get(r.id) ?? [] })))
      .map((row) => ({
        test_id: row.testId, test_name: names.get(row.testId) ?? '', date: row.date, run_id: row.runId,
        rejected_levels: row.rejectedLevels.map((l) => ({ level: l.level, lot: l.lot, rules: [...l.rules], point_id: l.pointId })),
        record: row.record ? { id: row.record.id, nce_id: row.record.nceId } : null,
        attach_to: row.attachTo ? { id: row.attachTo.id, nce_id: row.attachTo.nceId } : null,
      }));
  }

  /** Tài khoản có thể làm người phụ trách / chịu trách nhiệm hành động. */
  function listNceUsers(): NceUserOption[] {
    const rows = db.prepare("SELECT id, name, username, role, capabilities_json FROM users WHERE active<>0 ORDER BY name, username").all() as
      { id: string; name: string; username: string; role: string; capabilities_json: string }[];
    return rows.filter((row) => canWriteRole(row.role)).map((row) => ({
      id: row.id, name: row.name || row.username, username: row.username, role: roleOf(row.role), capabilities: parseNceCapabilities(row.capabilities_json),
    }));
  }

  function getNceConfig(): NceConfigView { return config(); }

  function activeWriter(userId: string): boolean {
    const row = db.prepare('SELECT role, active FROM users WHERE id=?').get(userId) as { role: string; active: number } | undefined;
    return !!row && !!row.active && canWriteRole(row.role);
  }

  // Lần chạy rerun hoặc xác minh

  function failureSnapshots(dossier: NceDossier): { trigger: NceRunSnapshot | null; repeats: NceRunSnapshot[] } {
    return {
      trigger: dossier.runs.find((run) => run.role === 'trigger')?.snapshot ?? null,
      repeats: dossier.runs.filter((run) => run.role === 'repeat_reject').map((run) => run.snapshot),
    };
  }

  /** Đánh giá lần chạy ứng viên TRONG GIAI ĐOẠN MỚI (coi chính nó là mốc cắt). */
  function checkCandidate(dossier: NceDossier, run: NceRunKey, lotChangeNote: string, alreadyCut = false): { snapshot: NceRunSnapshot; result: NceRerunResult } {
    const testId = dossier.testId!;
    const snapshot = nceRunSnapshot(db, testId, run, alreadyCut ? [] : [{ date: run.date, runId: run.runId }]);
    const { trigger, repeats } = failureSnapshots(dossier);
    const result = checkNceRerun({
      testId, trigger: dossier.source === 'iqc' ? trigger : null, repeatRejects: repeats, candidate: snapshot, lotChangeNote,
      requiredLevels: dossier.source === 'iqc' ? undefined : nceOperationalLevels(db, testId),
      notBeforeDate: dossier.detectedAt,
    });
    return { snapshot, result };
  }

  function previewNceRelease(input: unknown): IpcResult<NceReleasePreview> {
    const data = objectInput(objectInput(input).data);
    const loaded = load(cleanId(data.id));
    if (!loaded) return fail('not-found', 'Không tìm thấy hồ sơ.');
    if (!loaded.dossier.testId) return fail('no-test', 'Hồ sơ không gắn xét nghiệm nên không có lần chạy QC để xác minh.');
    const run = runKeyInput(data.rerun);
    if (!run) return fail('invalid-rerun', 'Chọn lần chạy QC để đánh giá.');
    const { snapshot, result } = checkCandidate(loaded.dossier, run, String(data.lotChangeNote ?? ''));
    return { ok: true, data: {
      ok: result.ok, problems: result.problems, lot_changed_levels: result.lotChangedLevels,
      points: snapshot.points.map((p) => ({ level: p.level, lot: p.lot, val: p.val, z: p.z, verdict: p.verdict, rules: [...p.rules], voided: p.voided })),
    } };
  }

  // Khung ghi dùng chung

  /** Nạp hồ sơ, kiểm phiên bản và (nếu có) thao tác được phép ở trạng thái hiện tại. */
  function open(data: Record<string, unknown>, operation: NceEditOperation | null): { loaded: NceLoaded; version: number } | IpcResult<never> {
    const id = cleanId(data.id);
    if (!id) return fail('missing-id', 'Thiếu mã hồ sơ.');
    const loaded = load(id);
    if (!loaded) return fail('not-found', 'Không tìm thấy hồ sơ.');
    const version = Number(data.expectedVersion);
    if (!Number.isInteger(version) || version !== loaded.row.row_version) return fail('stale', 'Hồ sơ vừa được người khác cập nhật; hãy tải lại trước khi sửa.');
    if (operation && !canDoNceOperation(loaded.row.status, operation)) return fail('status', 'Trạng thái hiện tại của hồ sơ không cho phép thao tác này.');
    return { loaded, version };
  }
  const isFailure = (value: unknown): value is IpcResult<never> => !!value && typeof value === 'object' && 'ok' in value;

  /** Ghi phần chung của mọi lệnh sửa: cập nhật bản ghi + tăng phiên bản, nhật
   * ký và lời báo đổi. `extra` ghi các bảng con trong cùng transaction. */
  function commitEdit(w: WriteSteps, loaded: NceLoaded, version: number, audit: [string, string], columns: Record<string, string | number | null>, extra?: (tx: WriteTx, now: string) => void, tables: string[] = ['nce_records']): IpcResult<NceDossierView> {
    const now = nowIso();
    w.commit((tx) => {
      if (!updateNceRecord(db, loaded.row.id, version, now, columns)) throw new Error('Hồ sơ vừa được người khác cập nhật.');
      extra?.(tx, now);
      tx.audit(audit[0], `${loaded.row.nce_id}: ${audit[1]}`, loaded.row.test_id || '');
      tx.changed(tables, loaded.row.test_id ? [loaded.row.test_id] : []);
    });
    return { ok: true, data: view(load(loaded.row.id)!, w.actor) };
  }

  // Tạo hồ sơ

  const createNce = writeCommand(db, 'createNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const today = isoLocalDate();
    const checked = validateNceCreate(objectInput(objectInput(input).data), today);
    if (!checked.ok) return fail(checked.code, checked.message);
    const draft = checked.data;
    if (!activeWriter(draft.ownerUserId)) return fail('invalid-owner', 'Người phụ trách phải là tài khoản đang hoạt động có quyền ghi.');
    if (draft.testId && !db.prepare('SELECT 1 FROM tests WHERE id=?').get(draft.testId)) return fail('test-not-found', 'Không tìm thấy xét nghiệm.');
    let snapshot: NceRunSnapshot | null = null;
    if (draft.trigger && draft.testId) {
      snapshot = nceRunSnapshot(db, draft.testId, draft.trigger);
      const missing = nceTriggerMissing(snapshot);
      if (missing.length) return fail(missing[0].code, missing[0].message);
      const owner = recordOfRun(db, draft.testId, draft.trigger.date, draft.trigger.runId);
      if (owner) return fail('run-has-record', `Lần chạy này đã thuộc hồ sơ ${owner.nce_id}.`);
    }
    const id = uid(), now = nowIso(), nceId = nextNceId(db, today);
    const errorClass = snapshot ? nceErrorClass([{ role: 'trigger', snapshot }]) : '';
    w.commit((tx) => {
      insertNceRecord(db, {
        id, nceId, source: draft.source, phase: draft.phase, testId: draft.testId, detectedAt: draft.detectedAt,
        description: draft.description, correction: draft.correction, holdResults: draft.holdResults,
        ownerUserId: draft.ownerUserId, dueDate: draft.dueDate || defaultNceDueDate(draft.detectedAt, '', config()),
        errorClass, checklistJson: JSON.stringify(emptyChecklist(draft.source)),
      }, w.actor, now);
      if (snapshot) insertNceRun(db, id, 'trigger', snapshot, w.actor, now);
      tx.audit('Tạo hồ sơ NCE', `Mở hồ sơ ${nceId}${snapshot ? ` · lần chạy ${runLabel(snapshot)}` : ''}`, draft.testId || '');
      tx.changed(['nce_records'], draft.testId ? [draft.testId] : []);
    });
    return { ok: true, data: view(load(id)!, w.actor) };
  });

  const attachNceRun = writeCommand(db, 'attachNceRun', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'attachRun'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened, { dossier } = loaded;
    if (dossier.source !== 'iqc' || !dossier.testId) return fail('not-iqc', 'Chỉ gắn lần chạy QC vào hồ sơ nội kiểm.');
    const run = runKeyInput(data.run);
    if (!run) return fail('invalid-run', 'Lần chạy không hợp lệ.');
    const trigger = dossier.runs.find((r) => r.role === 'trigger')?.snapshot;
    if (trigger && compareRun(run, trigger) <= 0) return fail('run-before-trigger', 'Chỉ gắn lần chạy bị loại SAU lần chạy khởi đầu.');
    const snapshot = nceRunSnapshot(db, dossier.testId, run);
    const missing = nceTriggerMissing(snapshot);
    if (missing.length) return fail(missing[0].code, missing[0].message);
    const owner = recordOfRun(db, dossier.testId, run.date, run.runId);
    if (owner) return fail('run-has-record', `Lần chạy này đã thuộc hồ sơ ${owner.nce_id}.`);
    return commitEdit(w, loaded, version, ['Gắn lần chạy vào NCE', `lần chạy ${runLabel(run)} bị loại`], {}, (_tx, now) => insertNceRun(db, loaded.row.id, 'repeat_reject', snapshot, w.actor, now));
  });

  // Sửa nội dung

  const updateNce = writeCommand(db, 'updateNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'update'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const patch = prepareNcePatch(data.patch, loaded.dossier);
    if (!patch.ok) return fail(patch.code, patch.message);
    if (patch.data.ownerUserId !== undefined && !activeWriter(patch.data.ownerUserId)) return fail('invalid-owner', 'Người phụ trách phải là tài khoản đang hoạt động có quyền ghi.');
    const changes = nceFieldChanges(editableOf(loaded.dossier, loaded.row.phase), patch.data);
    if (!Object.keys(changes).length) return w.noChange(view(loaded, w.actor));
    const changedPatch = Object.fromEntries(Object.keys(changes).map((key) => [key, patch.data[key as keyof typeof patch.data]]));
    return commitEdit(w, loaded, version, ['Cập nhật hồ sơ NCE', `sửa ${Object.keys(changes).join(', ')}`], columnsOfPatch(changedPatch),
      (_tx, now) => insertNceRevision(db, loaded.row.id, changes, w.actor, now));
  });

  // Hành động khắc phục

  function actionOf(loaded: NceLoaded, actionId: unknown) {
    return loaded.actions.find((action) => action.id === cleanId(actionId));
  }

  const addNceAction = writeCommand(db, 'addNceAction', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'addAction'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const draft = validateNceActionDraft(data.action, loaded.dossier.detectedAt);
    if (!draft.ok) return fail(draft.code, draft.message);
    if (!activeWriter(draft.data.ownerUserId)) return fail('invalid-owner', 'Người chịu trách nhiệm phải là tài khoản đang hoạt động có quyền ghi.');
    const actionId = uid();
    return commitEdit(w, loaded, version, ['Thêm hành động NCE', draft.data.description.slice(0, 120)], {}, (_tx, now) => {
      db.prepare(`INSERT INTO nce_actions(id,nce_record_id,kind,description,owner_user_id,due_date,status,created_at,created_by_user_id)
        VALUES (?,?,?,?,?,?,'open',?,?)`).run(actionId, loaded.row.id, draft.data.kind, draft.data.description, draft.data.ownerUserId, draft.data.dueDate, now, w.actor.userId);
      insertNceRevision(db, loaded.row.id, { [`action:${actionId}`]: [null, draft.data] }, w.actor, now);
    });
  });

  const updateNceAction = writeCommand(db, 'updateNceAction', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'updateAction'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const action = actionOf(loaded, data.actionId);
    if (!action) return fail('action-not-found', 'Không tìm thấy hành động.');
    if (action.status !== 'open') return fail('action-not-open', 'Chỉ sửa được hành động chưa hoàn thành.');
    const draft = validateNceActionDraft(data.action, loaded.dossier.detectedAt);
    if (!draft.ok) return fail(draft.code, draft.message);
    if (!activeWriter(draft.data.ownerUserId)) return fail('invalid-owner', 'Người chịu trách nhiệm phải là tài khoản đang hoạt động có quyền ghi.');
    const before = { kind: action.kind, description: action.description, ownerUserId: action.owner_user_id, dueDate: action.due_date };
    if (JSON.stringify(before) === JSON.stringify(draft.data)) return w.noChange(view(loaded, w.actor));
    return commitEdit(w, loaded, version, ['Sửa hành động NCE', draft.data.description.slice(0, 120)], {}, (_tx, now) => {
      db.prepare('UPDATE nce_actions SET kind=?, description=?, owner_user_id=?, due_date=? WHERE id=?')
        .run(draft.data.kind, draft.data.description, draft.data.ownerUserId, draft.data.dueDate, action.id);
      insertNceRevision(db, loaded.row.id, { [`action:${action.id}`]: [before, draft.data] }, w.actor, now);
    });
  });

  const completeNceAction = writeCommand(db, 'completeNceAction', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'completeAction'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const action = actionOf(loaded, data.actionId);
    if (!action) return fail('action-not-found', 'Không tìm thấy hành động.');
    const done = validateNceActionCompletion({ status: action.status }, data, loaded.dossier.detectedAt, isoLocalDate());
    if (!done.ok) return fail(done.code, done.message);
    return commitEdit(w, loaded, version, ['Hoàn thành hành động NCE', `${action.description.slice(0, 100)} · ${done.data.doneAt}`], {}, (_tx, now) => {
      db.prepare("UPDATE nce_actions SET status='done', done_at=?, done_by_user_id=?, done_by_name=?, evidence=? WHERE id=?")
        .run(done.data.doneAt, w.actor.userId, w.actor.name || w.actor.username, done.data.evidence, action.id);
      insertNceRevision(db, loaded.row.id, { [`action:${action.id}:done`]: [null, done.data] }, w.actor, now);
    });
  });

  const cancelNceAction = writeCommand(db, 'cancelNceAction', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'cancelAction'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const action = actionOf(loaded, data.actionId);
    if (!action) return fail('action-not-found', 'Không tìm thấy hành động.');
    const checked = validateNceActionCancel({ status: action.status }, data.reason);
    if (!checked.ok) return fail(checked.code, checked.message);
    return commitEdit(w, loaded, version, ['Hủy hành động NCE', `${action.description.slice(0, 100)} · lý do: ${checked.data.reason}`], {}, (_tx, now) => {
      db.prepare("UPDATE nce_actions SET status='cancelled', cancel_reason=? WHERE id=?").run(checked.data.reason, action.id);
      insertNceRevision(db, loaded.row.id, { [`action:${action.id}:cancel`]: [null, checked.data.reason] }, w.actor, now);
    });
  });

  // Quyết định

  const recordNcePatientImpact = writeCommand(db, 'recordNcePatientImpact', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'recordPatientImpact'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const impact = validateNcePatientImpact(data.impact, loaded.dossier.source);
    if (!impact.ok) return fail(impact.code, impact.message);
    return commitEdit(w, loaded, version, ['Đánh giá ảnh hưởng bệnh nhân NCE', impact.data.outcome], {},
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'patient_impact', impact.data, w.actor, now));
  });

  const reviewNceEffectiveness = writeCommand(db, 'reviewNceEffectiveness', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'reviewEffectiveness'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const review = validateNceEffectivenessReview(data.review, loaded.dossier, isoLocalDate());
    if (!review.ok) return fail(review.code, review.message);
    return commitEdit(w, loaded, version, ['Đánh giá hiệu lực NCE', `${review.data.result} · ${review.data.reviewedAt}`], {},
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'effectiveness', review.data, w.actor, now));
  });

  // Chuyển trạng thái

  function transitionTo(loaded: NceLoaded, transition: NceTransition): string | null {
    return nextNceStatus(loaded.row.status, transition);
  }

  const releaseNce = writeCommand(db, 'releaseNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, null); if (isFailure(opened)) return opened;
    const { loaded, version } = opened, { dossier } = loaded;
    const target = transitionTo(loaded, 'release');
    if (!target) return fail('status', 'Chỉ cho chạy lại hồ sơ đang xử lý.');
    const allowed = canReleaseNce(actorLike(w.actor)); if (!allowed.ok) return fail(allowed.code, allowed.message);
    const release = validateNceReleaseInput(data.release, dossier.source);
    if (!release.ok) return fail(release.code, release.message);
    if (release.data.rerun && !dossier.testId) return fail('no-test', 'Hồ sơ không gắn xét nghiệm nên không dùng lần chạy QC xác minh.');
    const candidate = release.data.rerun ? checkCandidate(dossier, release.data.rerun, release.data.lotChangeNote) : null;
    const missing = nceReleaseMissing(dossier, candidate?.result ?? null);
    if (missing.length) return fail('gate', `Chưa đủ điều kiện cho phép hoạt động trở lại: ${missingText(missing)}.`);
    const rerun = release.data.rerun;
    return commitEdit(w, loaded, version,
      ['Cho phép hoạt động trở lại NCE', rerun ? `rerun ${runLabel(rerun)} · ${release.data.reason}` : release.data.reason],
      { status: target },
      (_tx, now) => {
        if (candidate) insertNceRun(db, loaded.row.id, 'rerun', candidate.snapshot, w.actor, now);
        insertNceDecision(db, loaded.row.id, 'release', { ...release.data, lotChangedLevels: candidate?.result.lotChangedLevels ?? [] }, w.actor, now);
        // Mốc bắt đầu lại chuỗi có hiệu lực ngay khi cho chạy lại (D-03).
        if (rerun && dossier.testId) db.prepare('INSERT INTO nce_cuts(id,nce_record_id,test_id,date,run_id) VALUES (?,?,?,?,?)').run(uid(), loaded.row.id, dossier.testId, rerun.date, rerun.runId);
      },
      rerun ? ['nce_records', 'nce_cuts'] : ['nce_records']);
  });

  const submitNce = writeCommand(db, 'submitNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, null); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const target = transitionTo(loaded, 'submit');
    if (!target) return fail('status', 'Chỉ nộp duyệt hồ sơ đã cho chạy lại.');
    const allowed = canSubmitNce(actorLike(w.actor), loaded.dossier); if (!allowed.ok) return fail(allowed.code, allowed.message);
    const missing = nceSubmitMissing(loaded.dossier);
    if (missing.length) return fail('gate', `Hồ sơ chưa đủ điều kiện nộp duyệt: ${missingText(missing)}.`);
    return commitEdit(w, loaded, version, ['Nộp duyệt hồ sơ NCE', 'chờ duyệt'], { status: target },
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'submit', {}, w.actor, now));
  });

  /** Kiểm lại bằng chứng rerun trên dữ liệu hiện tại (điểm có thể đã bị hủy
   * sau khi cho chạy lại). Mốc cắt đã ghi nên không thêm mốc giả định. */
  function recheckRelease(dossier: NceDossier): NceRerunResult | null {
    const rerun = dossier.release?.rerun;
    if (!rerun || !dossier.testId) return null;
    return checkCandidate(dossier, rerun, dossier.release?.lotChangeNote ?? '', true).result;
  }

  const approveNce = writeCommand(db, 'approveNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, null); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const target = transitionTo(loaded, 'approve');
    if (!target) return fail('status', 'Chỉ duyệt hồ sơ đang chờ duyệt.');
    const exception = config().separationException;
    const allowed = canApproveNce(actorLike(w.actor), loaded.dossier, exception);
    if (!allowed.ok) return fail(allowed.code, allowed.message);
    const missing = nceApproveMissing(loaded.dossier, recheckRelease(loaded.dossier));
    if (missing.length) return fail('gate', `Hồ sơ chưa đủ điều kiện đóng: ${missingText(missing)}.`);
    const note = String(data.note ?? '').trim().slice(0, 2000);
    return commitEdit(w, loaded, version, ['Duyệt đóng hồ sơ NCE', allowed.usedException ? `ngoại lệ phân tách theo ${exception.sopRef}` : 'người duyệt độc lập'],
      { status: target, qc_resolved: 1 },
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'approve', { note, usedException: allowed.usedException, conflicts: allowed.conflicts, sopRef: allowed.usedException ? exception.sopRef : '' }, w.actor, now));
  });

  const returnNce = writeCommand(db, 'returnNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, null); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const target = transitionTo(loaded, 'return');
    if (!target) return fail('status', 'Chỉ trả lại hồ sơ đang chờ duyệt.');
    const allowed = canReturnNce(actorLike(w.actor)); if (!allowed.ok) return fail(allowed.code, allowed.message);
    const note = String(data.note ?? '').trim().slice(0, 2000);
    if (textLength(note) < 10) return fail('missing-note', 'Trả lại phải ghi lý do (ít nhất 10 ký tự).');
    return commitEdit(w, loaded, version, ['Trả lại hồ sơ NCE', note], { status: target },
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'return', { note }, w.actor, now));
  });

  const cancelNce = writeCommand(db, 'cancelNce', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, null); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const target = transitionTo(loaded, 'cancel');
    if (!target) return fail('status', 'Chỉ hủy được hồ sơ chưa cho phép hoạt động trở lại.');
    const allowed = canCancelNce(actorLike(w.actor), loaded.dossier); if (!allowed.ok) return fail(allowed.code, allowed.message);
    const reason = String(data.reason ?? '').trim().slice(0, 2000);
    if (textLength(reason) < 10) return fail('missing-reason', 'Hủy hồ sơ phải ghi lý do (ít nhất 10 ký tự).');
    return commitEdit(w, loaded, version, ['Hủy hồ sơ NCE', reason], { status: target },
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'cancel', { reason }, w.actor, now));
  });

  // Cấu hình

  const saveNceConfig = writeCommand(db, 'saveNceConfig', 'admin', (w, input: unknown): IpcResult<NceConfigView> => {
    const raw = objectInput(objectInput(input).data);
    const next = prepareNceConfig(raw);
    const sep = objectInput(raw.separationException);
    if (sep.enabled === true && !next.separationException.enabled) return fail('missing-sop', 'Bật ngoại lệ phân tách nhiệm vụ phải ghi mã SOP.');
    const current = config();
    if (JSON.stringify(current) === JSON.stringify(next)) return w.noChange(next);
    w.commit((tx) => {
      db.prepare("INSERT INTO app_meta(key,value) VALUES('nceConfig',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(next));
      tx.audit('Cấu hình NCE', `Hạn xử lý nhanh ${next.dueDays.low} ngày, CAPA ${next.dueDays.capa} ngày · tái diễn ${next.recurrenceWindowDays} ngày · ngoại lệ phân tách ${next.separationException.enabled ? `bật (${next.separationException.sopRef})` : 'tắt'}`);
      tx.changed(['app_meta']);
    });
    return { ok: true, data: next };
  });

  return {
    listNce, listNceQueue, getNce, listNceUsers, getNceConfig, previewNceRelease,
    createNce, attachNceRun, updateNce, addNceAction, updateNceAction, completeNceAction, cancelNceAction,
    recordNcePatientImpact, releaseNce, reviewNceEffectiveness, submitNce, approveNce, returnNce, cancelNce, saveNceConfig,
  };
}

export type NceHandlers = ReturnType<typeof createNceHandlers>;
