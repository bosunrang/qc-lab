// IPC handler cho hồ sơ NCE protocol 4 (docs/NCE-REDESIGN-2026-10-12.md).
// Nghiệp vụ (trạng thái, cổng, quyền, rerun) nằm ở `domain/nce/`; đọc/ghi
// bảng ở `db/nce-repository.ts`; đánh giá Westgard cho snapshot lần chạy ở
// `db/nce-evaluation.ts`. Tệp này chỉ ghép các bước theo khuôn
// `writeCommand()`: quyền → kiểm dữ liệu → commit (ghi + nhật ký + báo đổi).
//
// Mọi lệnh sửa một hồ sơ gửi `expectedVersion`; lệch `row_version` thì trả
// `stale` thay vì ghi đè thay đổi của người khác (sửa R-09).
import type { Db } from '../db/sqlite-like';
import { createEqaHandlers } from './eqa-handlers';
import { eqaNceSourceKey } from './eqa-corrective-reader';
import { sha256Hex } from '../domain/sha256';
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
import { ncePatientImpactCoverage, ncePatientImpactCoverageMissing, nceSuspectWindow, validateNcePatientImpact, type NceSuspectWindow } from '../domain/nce/patient-impact';
import { validateNceTechnicalAssessment } from '../domain/nce/technical-assessment';
import { nceCapaTriggers, nceErrorClass } from '../domain/nce/tier';
import { nceEffectivenessBasis, validateNceActionCancel, validateNceActionCompletion, validateNceActionDraft, validateNceEffectivenessReview } from '../domain/nce/actions';
import { emptyChecklist, nceFieldChanges, prepareNcePatch, prepareNceDetectedAtCorrection } from '../domain/nce/update';
import { defaultNceDueDate, prepareNceConfig, type NceConfig } from '../domain/nce/config';
import { compareRun, runLabel, textLength } from '../domain/nce/format';
import { nextNceId } from '../db/nce-ids';
import { isDateInLockedPeriod } from '../db/period-locks';
import {
  columnsOfPatch, editableOf, insertNceDecision, insertNceRecord, insertNceRevision, insertNceRun, listNceRows, loadNce,
  readNceConfig, recordOfRun, updateNceRecord, type NceLoaded,
} from '../db/nce-repository';
import { nceLatestRun, nceOperationalLevels, nceQueueRows, nceRunOutcomes, nceRunSnapshot, nceSuspectChain, nceTechnicalPrefill, nceChecklistHintsOf, nceRunVoids, nceTestScope } from '../db/nce-evaluation';
import { nceTimeline, type NceTimelineEntry } from '../domain/nce/timeline';
import { nceContainmentDraft } from '../domain/nce/containment-draft';
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
  const eqa = createEqaHandlers(db);
  const config = (): NceConfig => readNceConfig(db);

  /** Quyền NCE của người thực hiện đọc từ CSDL mỗi lần, để cấp/thu quyền có
   * hiệu lực ngay, kể cả với máy trạm LAN. */
  function actorLike(actor: Actor): NceActorLike {
    const row = db.prepare('SELECT capabilities_json FROM users WHERE id=?').get(actor.userId) as { capabilities_json: string } | undefined;
    return { userId: actor.userId, role: actor.role, capabilities: parseNceCapabilities(row?.capabilities_json) };
  }

  function load(id: string): NceLoaded | null { return loadNce(db, id, isoLocalDate(), config().recurrenceWindowDays); }

  /** Khoảng nghi ngờ của hồ sơ IQC trên dữ liệu QC hiện tại của đúng các lô
   * trong lần khởi đầu, kết thúc ở lần rerun đã chốt hoặc lần ứng viên
   * `rerun`; `null` khi không có lần khởi đầu. */
  function suspectOf(dossier: NceDossier, rerun: NceRunKey | null = dossier.release?.rerun ?? null): NceSuspectWindow | null {
    const trigger = dossier.runs.find((run) => run.role === 'trigger')?.snapshot;
    if (!trigger || !dossier.testId) return null;
    return nceSuspectWindow(nceRunOutcomes(db, dossier.testId, [], trigger), trigger, rerun, nceSuspectChain(db, dossier.testId, trigger));
  }

  // Đọc dữ liệu

  function view(loaded: NceLoaded, actor: Actor): NceDossierView {
    const { row, dossier } = loaded, who = actorLike(actor);
    const suspect = suspectOf(dossier);
    const approval = row.status === 'pending_approval' ? canApproveNce(who, dossier, config().separationException) : null;
    const editable = row.status === 'open' || row.status === 'released';
    return {
      record: row, runs: loaded.runs, actions: loaded.actions, decisions: loaded.decisions, revisions: loaded.revisions,
      missing: [...nceNextStep(dossier, null, suspect, row.status === 'released' || row.status === 'pending_approval' ? recheckRelease(dossier) : null).missing, ...eqaClosureMissing(loaded)], capa_triggers: nceCapaTriggers(dossier), recurrence: dossier.recurrence,
      eqa_followup: eqaFollowup(loaded),
      suspect_window: suspect ? {
        last_accepted: suspect.lastAccepted, onset: suspect.onset, onset_rules: suspect.onsetRules,
        trigger: { date: suspect.trigger.date, runId: suspect.trigger.runId },
        rerun: suspect.rerun, runs: suspect.runs,
      } : null,
      can: {
        edit: editable && canWriteNce(who).ok,
        release: row.status === 'open' && canReleaseNce(who).ok,
        // Quyết định ảnh hưởng bệnh nhân là quyết định chuyên môn: cùng thẩm
        // quyền với cho phép hoạt động trở lại.
        patient_impact: editable && canReleaseNce(who).ok,
        submit: row.status === 'released' && canSubmitNce(who, dossier).ok,
        approve: !!approval?.ok,
        return: row.status === 'pending_approval' && canReturnNce(who).ok,
        cancel: row.status === 'open' && canCancelNce(who, dossier).ok,
        review_effectiveness: row.status === 'released' && canWriteNce(who).ok,
      },
      approve_block: approval && !approval.ok ? approval.message : '',
      // Gợi ý số liệu chỉ cần khi còn ghi được đánh giá kỹ thuật (hồ sơ IQC
      // chưa nộp duyệt); chỉ đọc, không đổi cổng nào.
      technical_prefill: editable && dossier.source === 'iqc' && dossier.testId && suspect
        ? technicalPrefillOf(dossier, suspect.onset) : null,
      checklist_hints: editable ? checklistHintsOf(dossier) : {},
      timeline: timelineOf(loaded, suspect),
      containment_draft: editable && dossier.source === 'iqc' ? containmentDraftOf(dossier, suspect) : '',
    };
  }

  /** Dòng thời gian dựng từ dữ liệu đã lưu, thay việc gõ lại các mốc. */
  function timelineOf(loaded: NceLoaded, suspect: NceSuspectWindow | null): NceTimelineEntry[] {
    const { row, dossier } = loaded;
    const trigger = dossier.runs.find((run) => run.role === 'trigger')?.snapshot ?? null;
    const rerun = dossier.runs.find((run) => run.role === 'rerun')?.snapshot ?? null;
    return nceTimeline({
      detectedAt: row.detected_at, createdAt: row.created_at, reportedBy: row.reported_by_name,
      onset: suspect?.onset ?? null, onsetRules: suspect?.onsetRules ?? [],
      trigger: trigger && { date: trigger.date, runId: trigger.runId },
      repeats: dossier.runs.filter((run) => run.role === 'repeat_reject').map((run) => ({ date: run.snapshot.date, runId: run.snapshot.runId })),
      voids: trigger && dossier.testId ? nceRunVoids(db, dossier.testId, trigger) : [],
      rerun: rerun && { date: rerun.date, runId: rerun.runId },
      decisions: loaded.decisions.map((d) => ({ type: d.type, at: d.decided_at, actor: d.actor_name })),
      actionsDone: loaded.actions.filter((a) => a.status === 'done').map((a) => ({ description: a.description, at: a.done_at, by: a.done_by_name })),
    });
  }

  function containmentDraftOf(dossier: NceDossier, suspect: NceSuspectWindow | null): string {
    const trigger = dossier.runs.find((run) => run.role === 'trigger')?.snapshot;
    if (!trigger || !dossier.testId) return '';
    const lots = new Map<number, string>();
    for (const point of trigger.points) if (!lots.has(point.level)) lots.set(point.level, point.lot);
    return nceContainmentDraft({
      ...nceTestScope(db, dossier.testId), lots: [...lots].map(([level, lot]) => ({ level, lot })),
      lastAccepted: suspect?.lastAccepted ?? null, onset: suspect?.onset ?? null, trigger: { date: trigger.date, runId: trigger.runId },
    });
  }

  function checklistHintsOf(dossier: NceDossier): Record<string, string> {
    const trigger = dossier.runs.find((run) => run.role === 'trigger')?.snapshot;
    return trigger && dossier.testId ? nceChecklistHintsOf(db, dossier.testId, trigger) : {};
  }

  function technicalPrefillOf(dossier: NceDossier, onset: NceRunKey) {
    const trigger = dossier.runs.find((run) => run.role === 'trigger')?.snapshot;
    return trigger && dossier.testId ? nceTechnicalPrefill(db, dossier.testId, trigger, onset) : null;
  }

  function getNce(id: unknown, actor: Actor): NceDossierView | null {
    const loaded = load(cleanId(id));
    return loaded ? view(loaded, actor) : null;
  }

  function eqaFollowup(loaded: NceLoaded): NonNullable<NceDossierView['eqa_followup']> | null {
    if (!loaded.row.eqa_result_id) return null;
    let source: import('../../shared/qc-api').EqaNceEvidence;
    try { source = JSON.parse(loaded.row.eqa_snapshot_json); } catch { return { evidence: null, missing: ['Thiếu căn cứ ngoại kiểm đã lưu.'], fingerprint: '' }; }
    if (!source?.round?.id || !source?.result?.test_id) return { evidence: null, missing: ['Căn cứ ngoại kiểm đã lưu không hợp lệ.'], fingerprint: '' };
    const missing: string[] = [];
    const rounds = eqa.listEqaRounds().filter(r => r.status === 'open' && r.program_id === source.round.program_id
      && (r.year > source.round.year || r.year === source.round.year && r.round_no > source.round.round_no)).sort((a, b) => a.year - b.year || a.round_no - b.round_no);
    const completed = loaded.actions.filter(a => a.status === 'done').map(a => a.done_at.slice(0, 10)).sort().at(-1);
    const candidates = rounds.map(r => eqa.getEqaRound(r.id)!).filter(r => r.results.some(p => p.test_id === source.result.test_id));
    // Đợt đã chạy trước khi hoàn tất hành động không thể chứng minh hiệu lực;
    // đợt thiếu ngày vẫn cần bổ sung, không tự bỏ qua để chọn một đợt đạt.
    const next = candidates.find(r => {
      if (!completed) return true;
      try { const date = eqa.getEqaCorrectiveEvidence({ resultId: r.results.find(p => p.test_id === source.result.test_id)!.id }).run_date; return !date || date > completed; }
      catch { return true; }
    }) || candidates.at(-1);
    let evidence: typeof source | null = null;
    if (!next) missing.push('Chưa có kết quả ở đợt ngoại kiểm kế tiếp của xét nghiệm.');
    else {
      const samples = next.results.filter(r => r.test_id === source.result.test_id);
      if (samples.some(r => r.class !== 'ok' || r.trend?.unsuccessful || r.trend?.signals.length)) missing.push('Đợt ngoại kiểm kế tiếp chưa chấp nhận toàn bộ mẫu hoặc còn tín hiệu chuỗi.');
      try { evidence = eqa.getEqaCorrectiveEvidence({ resultId: samples[0].id }); }
      catch { missing.push('Ngày chạy của đợt kế tiếp chưa hợp lệ. Kiểm tra Lịch ngoại kiểm.'); }
      if (evidence) {
        if (!evidence.run_date) missing.push('Ghi ngày chạy mẫu thực tế của đợt kế tiếp trong Lịch ngoại kiểm.');
        if (!completed) missing.push('Chưa có hành động đã hoàn thành để đối chiếu hiệu lực.');
        else if (evidence.run_date && evidence.run_date <= completed) missing.push('Cần mẫu của đợt kế tiếp chạy sau ngày hoàn thành hành động.');
        const points = evidence.iqc_runs.flatMap(r => r.points).filter(p => !p.voided);
        if (!evidence.iqc_runs.length || evidence.iqc_runs.some(r => !r.complete) || !points.length || points.some(p => p.verdict !== 'ok')) missing.push('Nội kiểm cùng ngày chạy đợt kế tiếp chưa đủ mức, chưa có dữ liệu hoặc còn tín hiệu.');
      }
    }
    // Băm nội dung kết quả (khoá nguồn), không băm mã dòng hay phiên bản đợt:
    // bổ sung máy khác vào đợt kế tiếp sinh lại mã dòng và tăng phiên bản, còn
    // `trend.enough`/TEa đổi theo dữ liệu ngoài; cả hai không đổi bằng chứng hiệu lực (N-13).
    const fingerprint = sha256Hex(JSON.stringify([evidence && { source: eqaNceSourceKey(evidence), run_date: evidence.run_date, iqc: evidence.iqc_runs },
      next?.results.filter(r => r.test_id === source.result.test_id).map(result => eqaNceSourceKey({ round: next.round, result })), loaded.row.checklist_json, loaded.decisions.filter(d => d.type === 'patient_impact').at(-1)?.payload_json]));
    return { evidence, missing, fingerprint };
  }

  function eqaClosureMissing(loaded: NceLoaded): NceMissing[] {
    if (!loaded.row.eqa_result_id || !['released', 'pending_approval'].includes(loaded.row.status)) return [];
    const latest = loaded.decisions.filter(d => d.type === 'effectiveness').at(-1);
    if (!latest) return [];
    const payload = JSON.parse(latest.payload_json) as { result: string; eqa_basis?: string };
    if (payload.result !== 'effective') return [];
    const followup = eqaFollowup(loaded)!;
    return [...followup.missing.map(message => ({ code: 'effectiveness-eqa', message })),
      ...(payload.eqa_basis === followup.fingerprint ? [] : [{ code: 'effectiveness-eqa-stale', message: 'Bằng chứng ngoại kiểm/nội kiểm hoặc điều tra đã thay đổi: đánh giá lại hiệu lực.' }])];
  }

  function listNce(): NceRecordRow[] { return listNceRows(db, isoLocalDate()); }

  function listNceQueue(): NceQueueRowView[] {
    const names = new Map((db.prepare('SELECT id, name FROM tests').all() as { id: string; name: string }[]).map((t) => [t.id, t.name]));
    return nceQueueRows(db)
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
  function checkCandidate(dossier: NceDossier, run: NceRunKey, lotChangeNote: string, alreadyCut = false): { snapshot: NceRunSnapshot; result: NceRerunResult; warnings: NceMissing[] } {
    const testId = dossier.testId!;
    const reference = alreadyCut ? dossier.runs.find((r) => r.role === 'rerun')?.snapshot : undefined;
    const snapshot = nceRunSnapshot(db, testId, run, alreadyCut ? [] : [{ date: run.date, runId: run.runId }], reference);
    const { trigger, repeats } = failureSnapshots(dossier);
    // Lần hỏng chưa được gắn hồ sơ vẫn là bằng chứng không thể bỏ qua khi
    // chọn mốc khôi phục. Khi duyệt lại, không lấy sự kiện SAU release cũ.
    const otherFailures = !alreadyCut && trigger ? nceRunOutcomes(db, testId, [{ date: run.date, runId: run.runId }])
      .filter((r) => r.rejected && compareRun(r, trigger) > 0).sort(compareRun) : [];
    const latestOtherFailure = otherFailures.at(-1);
    // Lần hỏng trước ứng viên mà chưa thuộc hồ sơ nào (kể cả hồ sơ này) phải gắn
    // vào hồ sơ trước khi cho chạy lại (D-01).
    const unattachedFailures = dossier.source === 'iqc'
      ? otherFailures.filter((r) => compareRun(r, run) < 0 && !recordOfRun(db, testId, r.date, r.runId)).map((r) => ({ date: r.date, runId: r.runId }))
      : [];
    // Chỉ cần khoá lần hỏng cuối để kiểm thứ tự, không đánh giá lại toàn bộ
    // CSDL thêm một lần cho từng lần hỏng. Snapshot này không được lưu.
    const additional: NceRunSnapshot[] = latestOtherFailure ? [{ testId, date: latestOtherFailure.date, runId: latestOtherFailure.runId, points: [] }] : [];
    const result = checkNceRerun({
      testId, trigger: dossier.source === 'iqc' ? trigger : null, repeatRejects: [...repeats, ...additional], candidate: snapshot, lotChangeNote,
      requiredLevels: dossier.source === 'iqc' ? undefined : nceOperationalLevels(db, testId),
      notBeforeDate: dossier.detectedAt, unattachedFailures,
    });
    const absent = nceOperationalLevels(db, testId).filter((level) => !snapshot.points.some((p) => p.level === level && !p.voided));
    const warnings = absent.length ? [{ code: 'rerun-operational-levels', message: `Chưa có mức ${absent.map((l) => `M${l}`).join(', ')} so với cấu hình vận hành hiện tại. Cổng hiện hành dùng các mức của lần khởi đầu; phải đối chiếu đủ mức theo SOP trước khi quyết định.` }] : [];
    return { snapshot, result, warnings };
  }

  function previewNceRelease(input: unknown): IpcResult<NceReleasePreview> {
    const data = objectInput(objectInput(input).data);
    const loaded = load(cleanId(data.id));
    if (!loaded) return fail('not-found', 'Không tìm thấy hồ sơ.');
    if (!loaded.dossier.testId) return fail('no-test', 'Hồ sơ không gắn xét nghiệm nên không có lần chạy QC để xác minh.');
    const run = runKeyInput(data.rerun);
    if (!run) return fail('invalid-rerun', 'Chọn lần chạy QC để đánh giá.');
    const { snapshot, result, warnings } = checkCandidate(loaded.dossier, run, String(data.lotChangeNote ?? ''));
    const impactProblems = ncePatientImpactCoverageMissing(loaded.dossier.patientImpacts.at(-1), suspectOf(loaded.dossier, run));
    return { ok: true, data: {
      ok: result.ok, problems: result.problems, lot_changed_levels: result.lotChangedLevels, warnings, impact_problems: impactProblems,
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
    const raw = objectInput(objectInput(input).data);
    let eqaEvidence: ReturnType<typeof eqa.getEqaCorrectiveEvidence> | null = null;
    if (raw.eqaResultId !== undefined) {
      if (raw.source !== 'eqa') return fail('eqa-source', 'Kết quả ngoại kiểm chỉ gắn vào hồ sơ nguồn ngoại kiểm.');
      try { eqaEvidence = eqa.getEqaCorrectiveEvidence({ resultId: raw.eqaResultId, runDate: raw.eqaRunDate }); }
      catch (error) { return fail('eqa-result', error instanceof Error ? error.message : 'Không đọc được kết quả ngoại kiểm.'); }
      if (raw.expectedEqaFingerprint !== eqaEvidence.fingerprint) return fail('eqa-stale', 'Báo cáo ngoại kiểm đã thay đổi. Tải lại căn cứ trước khi lập hồ sơ.');
      if (!eqaEvidence.reasons.length) return fail('eqa-no-trigger', 'Kết quả này chưa có cảnh báo hoặc tín hiệu cần điều tra.');
      if (!eqaEvidence.run_date) return fail('eqa-run-date', 'Ghi ngày chạy mẫu ngoại kiểm thực tế để đối chiếu nội kiểm.');
      if (eqaEvidence.run_date > String(raw.detectedAt || '')) return fail('eqa-run-date', 'Ngày chạy mẫu không được sau ngày phát hiện.');
      const existing = db.prepare("SELECT nce_id FROM nce_records WHERE eqa_source_key=? AND status<>'cancelled'").get(eqaNceSourceKey(eqaEvidence)) as { nce_id: string } | undefined;
      if (existing) return fail('eqa-has-record', `Kết quả này đã thuộc hồ sơ ${existing.nce_id}. Mở hồ sơ hiện có để tiếp tục xử lý.`);
    }
    const checked = validateNceCreate({ ...raw, ...(eqaEvidence ? { testId: eqaEvidence.result.test_id, phase: 'exam' } : {}) }, today);
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
        errorClass, checklistJson: JSON.stringify(emptyChecklist(draft.source, !!eqaEvidence)),
      }, w.actor, now);
      if (eqaEvidence) db.prepare("UPDATE nce_records SET eqa_result_id=?,eqa_source_key=?,eqa_snapshot_json=?,tier='capa',due_date=? WHERE id=?")
        .run(eqaEvidence.result.id, eqaNceSourceKey(eqaEvidence), JSON.stringify(eqaEvidence), draft.dueDate || defaultNceDueDate(draft.detectedAt, 'capa', config()), id);
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
    // Đính chính ngày cần quyền release và không đi chung patch nội dung:
    // không cho máy trạm vượt cổng bằng cách tự gửi trường ngày trong patch.
    if (Object.hasOwn(data, 'detectedAtCorrection')) {
      const permission = canReleaseNce(actorLike(w.actor));
      if (!permission.ok) return fail(permission.code, permission.message);
      const opened = open(data, null); if (isFailure(opened)) return opened;
      const { loaded, version } = opened;
      if (Object.keys(objectInput(data.patch)).length) return fail('mixed-date-correction', 'Đính chính ngày phải được lưu riêng với các sửa đổi nội dung.');
      const checked = prepareNceDetectedAtCorrection(data.detectedAtCorrection, loaded.dossier, loaded.row.created_at, isoLocalDate());
      if (!checked.ok) return fail(checked.code, checked.message);
      if (checked.data.detectedAt === loaded.row.detected_at) return w.noChange(view(loaded, w.actor));
      const changes = { detectedAt: [loaded.row.detected_at, checked.data.detectedAt], dateCorrectionReason: [null, checked.data.reason] };
      return commitEdit(w, loaded, version, ['Đính chính ngày phát hiện NCE', `${loaded.row.detected_at} → ${checked.data.detectedAt}; căn cứ: ${checked.data.reason}`], { detected_at: checked.data.detectedAt },
        (_tx, now) => insertNceRevision(db, loaded.row.id, changes, w.actor, now));
    }
    const opened = open(data, 'update'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const patch = prepareNcePatch(data.patch, loaded.dossier);
    if (!patch.ok) return fail(patch.code, patch.message);
    if (patch.data.ownerUserId !== undefined && !activeWriter(patch.data.ownerUserId)) return fail('invalid-owner', 'Người phụ trách phải là tài khoản đang hoạt động có quyền ghi.');
    // Hồ sơ lập với hạn mặc định của tầng xử lý nhanh; chuyển sang CAPA mà hạn
    // chưa được ai sửa thì dời theo hạn CAPA trong Cài đặt. Hạn đã chỉnh tay
    // thì giữ nguyên, và không bao giờ tự rút ngắn hạn.
    const { dossier: current } = loaded;
    if (patch.data.tier === 'capa' && current.tier !== 'capa' && patch.data.dueDate === undefined
      && current.dueDate === defaultNceDueDate(current.detectedAt, current.tier || '', config())) {
      const capaDue = defaultNceDueDate(current.detectedAt, 'capa', config());
      if (capaDue > current.dueDate) patch.data.dueDate = capaDue;
    }
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
    return commitEdit(w, loaded, version, ['Huỷ hành động NCE', `${action.description.slice(0, 100)} · lý do: ${checked.data.reason}`], {}, (_tx, now) => {
      db.prepare("UPDATE nce_actions SET status='cancelled', cancel_reason=? WHERE id=?").run(checked.data.reason, action.id);
      insertNceRevision(db, loaded.row.id, { [`action:${action.id}:cancel`]: [null, checked.data.reason] }, w.actor, now);
    });
  });

  // Quyết định

  const recordNceTechnicalAssessment = writeCommand(db, 'recordNceTechnicalAssessment', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'recordTechnicalAssessment'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const assessment = validateNceTechnicalAssessment(data.assessment, loaded.dossier);
    if (!assessment.ok) return fail(assessment.code, assessment.message);
    return commitEdit(w, loaded, version,
      ['Xác minh kỹ thuật IQC', `${assessment.data.errorNature} · ${assessment.data.technicalSignal}`], {},
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'technical_assessment', assessment.data, w.actor, now));
  });

  const recordNcePatientImpact = writeCommand(db, 'recordNcePatientImpact', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'recordPatientImpact'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const allowed = canReleaseNce(actorLike(w.actor));
    if (!allowed.ok) return fail('forbidden-patient-impact', 'Quyết định ảnh hưởng kết quả bệnh nhân cần người có thẩm quyền (quyền nce.release).');
    const impact = validateNcePatientImpact(data.impact, loaded.dossier.source, loaded.dossier);
    if (!impact.ok) return fail(impact.code, impact.message);
    // Main tự chụp phạm vi đã rà soát; không nhận khoảng do client gửi.
    const suspect = suspectOf(loaded.dossier);
    const coverage = suspect && loaded.dossier.testId ? ncePatientImpactCoverage(suspect, nceLatestRun(db, loaded.dossier.testId)) : null;
    return commitEdit(w, loaded, version, ['Đánh giá ảnh hưởng bệnh nhân NCE', coverage ? `${impact.data.outcome} · tới ${runLabel(coverage.through)}` : impact.data.outcome], {},
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'patient_impact', { ...impact.data, coverage }, w.actor, now));
  });

  const reviewNceEffectiveness = writeCommand(db, 'reviewNceEffectiveness', 'write', (w, input: unknown): IpcResult<NceDossierView> => {
    const data = objectInput(objectInput(input).data);
    const opened = open(data, 'reviewEffectiveness'); if (isFailure(opened)) return opened;
    const { loaded, version } = opened;
    const review = validateNceEffectivenessReview(data.review, loaded.dossier, isoLocalDate());
    if (!review.ok) return fail(review.code, review.message);
    const followup = eqaFollowup(loaded);
    if (followup && review.data.result === 'effective') {
      if (followup.missing.length) return fail('effectiveness-eqa', followup.missing.join(' '));
      if (followup.evidence && review.data.reviewedAt < [followup.evidence.run_date, followup.evidence.round.report_date].sort().at(-1)!) return fail('effectiveness-eqa-date', 'Ngày đánh giá không được trước ngày chạy mẫu hoặc ngày phát hành báo cáo ngoại kiểm kế tiếp.');
    }
    return commitEdit(w, loaded, version, ['Đánh giá hiệu lực NCE', `${review.data.result} · ${review.data.reviewedAt}`], {},
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'effectiveness', { ...review.data, basis: nceEffectivenessBasis(loaded.dossier), ...(followup ? { eqa_basis: followup.fingerprint, eqa_evidence: followup.evidence } : {}) }, w.actor, now));
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
    const missing = nceReleaseMissing(dossier, candidate?.result ?? null, suspectOf(dossier, release.data.rerun));
    if (missing.length) return fail('gate', `Chưa đủ điều kiện cho phép hoạt động trở lại: ${missingText(missing)}.`);
    const rerun = release.data.rerun;
    // Ghi mốc cắt có thể đổi verdict của các điểm từ rerun trở đi, kể cả
    // kỳ khoá nằm SAU ngày rerun. Không chỉ kiểm tháng chứa mốc cắt.
    if (rerun && dossier.testId) {
      const dates = db.prepare('SELECT DISTINCT date FROM qc_points WHERE test_id=? AND date>=?').all(dossier.testId, rerun.date) as { date: string }[];
      if (isDateInLockedPeriod(db, rerun.date) || dates.some((row) => isDateInLockedPeriod(db, row.date))) {
        return fail('period-locked', 'Mốc bắt đầu lại QC ảnh hưởng dữ liệu thuộc kỳ đã khoá. Cần người có thẩm quyền mở khoá và rà soát trước.');
      }
    }
    return commitEdit(w, loaded, version,
      ['Cho phép hoạt động trở lại NCE', rerun ? `rerun ${runLabel(rerun)} · ${release.data.reason}` : release.data.reason],
      { status: target },
      (_tx, now) => {
        if (candidate) insertNceRun(db, loaded.row.id, 'rerun', candidate.snapshot, w.actor, now);
        insertNceDecision(db, loaded.row.id, 'release', { ...release.data, lotChangedLevels: candidate?.result.lotChangedLevels ?? [], verificationWarnings: candidate?.warnings ?? [] }, w.actor, now);
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
    const missing = [...nceSubmitMissing(loaded.dossier, suspectOf(loaded.dossier), recheckRelease(loaded.dossier)), ...eqaClosureMissing(loaded)];
    if (missing.length) return fail('gate', `Hồ sơ chưa đủ điều kiện nộp duyệt: ${missingText(missing)}.`);
    return commitEdit(w, loaded, version, ['Nộp duyệt hồ sơ NCE', 'chờ duyệt'], { status: target },
      (_tx, now) => insertNceDecision(db, loaded.row.id, 'submit', {}, w.actor, now));
  });

  /** Kiểm lại bằng chứng rerun trên dữ liệu hiện tại (điểm có thể đã bị huỷ
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
    const missing = [...nceApproveMissing(loaded.dossier, recheckRelease(loaded.dossier), suspectOf(loaded.dossier)), ...eqaClosureMissing(loaded)];
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
    if (!target) return fail('status', 'Chỉ huỷ được hồ sơ chưa cho phép hoạt động trở lại.');
    const allowed = canCancelNce(actorLike(w.actor), loaded.dossier); if (!allowed.ok) return fail(allowed.code, allowed.message);
    const reason = String(data.reason ?? '').trim().slice(0, 2000);
    if (textLength(reason) < 10) return fail('missing-reason', 'Huỷ hồ sơ phải ghi lý do (ít nhất 10 ký tự).');
    return commitEdit(w, loaded, version, ['Huỷ hồ sơ NCE', reason], { status: target },
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
    recordNceTechnicalAssessment, recordNcePatientImpact, releaseNce, reviewNceEffectiveness, submitNce, approveNce, returnNce, cancelNce, saveNceConfig,
  };
}

export type NceHandlers = ReturnType<typeof createNceHandlers>;
