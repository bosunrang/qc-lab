// Đọc/ghi các bảng `nce_*` và dựng hồ sơ dạng miền (`NceDossier`) cho các
// cổng ở `domain/nce/`. Handler (`ipc/nce-handlers.ts`, `ipc/entry-handlers.ts`)
// gọi các hàm ghi ở đây BÊN TRONG `w.commit()`; tệp này không tự mở transaction.
import type { Db } from './sqlite-like';
import { uid } from '../domain/text-utils';
import type { NceActionRow, NceDecisionRow, NceRecordRow, NceRevisionRow, NceRunRow } from '../../shared/qc-api';
import type {
  NceAction, NceChecklistItem, NceDossier, NceEffectivenessReview, NcePatientImpact, NceRelease, NceRunRole, NceRunSnapshot,
  NceTechnicalAssessment,
} from '../domain/nce/types';
import { nceIsRecurrence, nceErrorClass } from '../domain/nce/tier';
import { nceActionOverdueDays, nceRecordOverdueDays } from '../domain/nce/overdue';
import type { NceEditable, NceEditableField } from '../domain/nce/update';
import { prepareNceConfig, type NceConfig } from '../domain/nce/config';

/** Người thực hiện — cùng hình dạng phần cần dùng của `Actor` ở tầng IPC. */
export interface NceActorRef { userId: string; username: string; name: string }

type RecordColumns = Omit<NceRecordRow, 'test_name' | 'owner_name' | 'overdue_days' | 'next_step' | 'open_actions' | 'overdue_actions'>;

function parseJson<T>(json: string, fallback: T): T {
  try { const value = JSON.parse(json || ''); return value && typeof value === 'object' ? value as T : fallback; } catch { return fallback; }
}

const NEXT_STEP: Readonly<Record<string, NceRecordRow['next_step']>> = { open: 'release', released: 'submit', pending_approval: 'approve' };

export function nceUserNames(db: Db): Map<string, string> {
  const rows = db.prepare('SELECT id, name, username FROM users').all() as { id: string; name: string; username: string }[];
  return new Map(rows.map((row) => [row.id, row.name || row.username]));
}

function testNames(db: Db): Map<string, string> {
  return new Map((db.prepare('SELECT id, name FROM tests').all() as { id: string; name: string }[]).map((row) => [row.id, row.name]));
}

/** Danh sách hồ sơ kèm trường tính; mới nhất lên trước. */
export function listNceRows(db: Db, today: string): NceRecordRow[] {
  const users = nceUserNames(db), tests = testNames(db);
  const actions = db.prepare("SELECT nce_record_id, status, due_date FROM nce_actions WHERE status='open'").all() as { nce_record_id: string; status: 'open'; due_date: string }[];
  const openByRecord = new Map<string, { open: number; overdue: number }>();
  for (const action of actions) {
    const count = openByRecord.get(action.nce_record_id) ?? { open: 0, overdue: 0 };
    count.open++;
    if (nceActionOverdueDays({ status: action.status, dueDate: action.due_date }, today) > 0) count.overdue++;
    openByRecord.set(action.nce_record_id, count);
  }
  const rows = db.prepare('SELECT * FROM nce_records ORDER BY created_at DESC, id DESC').all() as unknown as RecordColumns[];
  return rows.map((row) => decorate(row, users, tests, openByRecord.get(row.id), today));
}

function decorate(row: RecordColumns, users: Map<string, string>, tests: Map<string, string>, counts: { open: number; overdue: number } | undefined, today: string): NceRecordRow {
  return {
    ...row,
    test_name: row.test_id ? tests.get(row.test_id) ?? '(đã xoá)' : '',
    owner_name: users.get(row.owner_user_id) ?? '',
    overdue_days: nceRecordOverdueDays({ status: row.status, dueDate: row.due_date }, today),
    next_step: NEXT_STEP[row.status] ?? null,
    open_actions: counts?.open ?? 0, overdue_actions: counts?.overdue ?? 0,
  };
}

export interface NceLoaded {
  row: NceRecordRow; runs: NceRunRow[]; actions: NceActionRow[]; decisions: NceDecisionRow[]; revisions: NceRevisionRow[];
  dossier: NceDossier;
}

export function loadNce(db: Db, id: string, today: string, recurrenceWindowDays: number): NceLoaded | null {
  const base = db.prepare('SELECT * FROM nce_records WHERE id=?').get(id) as unknown as RecordColumns | undefined;
  if (!base) return null;
  const users = nceUserNames(db), tests = testNames(db);
  const runs = db.prepare('SELECT * FROM nce_runs WHERE nce_record_id=? ORDER BY date, run_id').all(id) as unknown as NceRunRow[];
  const actions = (db.prepare('SELECT * FROM nce_actions WHERE nce_record_id=? ORDER BY created_at, id').all(id) as unknown as Omit<NceActionRow, 'owner_name' | 'overdue_days'>[])
    .map((action) => ({ ...action, owner_name: users.get(action.owner_user_id) ?? '', overdue_days: nceActionOverdueDays({ status: action.status, dueDate: action.due_date }, today) }));
  const decisions = db.prepare('SELECT * FROM nce_decisions WHERE nce_record_id=? ORDER BY decided_at, rowid').all(id) as unknown as NceDecisionRow[];
  const revisions = db.prepare('SELECT * FROM nce_revisions WHERE nce_record_id=? ORDER BY at, rowid').all(id) as unknown as NceRevisionRow[];
  const counts = { open: actions.filter((a) => a.status === 'open').length, overdue: actions.filter((a) => a.overdue_days > 0).length };
  const row = decorate(base, users, tests, counts, today);
  const recurrence = recurrenceOf(db, row, runs, recurrenceWindowDays);
  return { row, runs, actions, decisions, revisions, dossier: toDossier(row, runs, actions, decisions, recurrence) };
}

function recurrenceOf(db: Db, row: RecordColumns, runs: readonly NceRunRow[], windowDays: number): boolean {
  if (!row.test_id) return false;
  const others = db.prepare('SELECT id, test_id, source, error_class, detected_at, status FROM nce_records WHERE test_id=? AND id<>?').all(row.test_id, row.id) as
    { id: string; test_id: string; source: NceDossier['source']; error_class: string; detected_at: string; status: string }[];
  const errorClass = row.error_class || nceErrorClass(runs.map((run) => ({ role: run.role, snapshot: parseJson<NceRunSnapshot>(run.snapshot_json, emptySnapshot(run)) })));
  return nceIsRecurrence(
    { id: row.id, testId: row.test_id, source: row.source, errorClass, detectedDate: row.detected_at, cancelled: false },
    others.map((o) => ({ id: o.id, testId: o.test_id, source: o.source, errorClass: o.error_class, detectedDate: o.detected_at, cancelled: o.status === 'cancelled' })),
    windowDays,
  );
}

function emptySnapshot(run: Pick<NceRunRow, 'test_id' | 'date' | 'run_id'>): NceRunSnapshot {
  return { testId: run.test_id, date: run.date, runId: run.run_id, points: [] };
}

export function runSnapshotOf(run: NceRunRow): NceRunSnapshot {
  const snapshot = parseJson<Partial<NceRunSnapshot>>(run.snapshot_json, {});
  return { testId: run.test_id, date: run.date, runId: run.run_id, points: Array.isArray(snapshot.points) ? snapshot.points : [] };
}

/** Dựng hồ sơ dạng miền từ các dòng đã đọc. */
export function toDossier(row: RecordColumns, runs: readonly NceRunRow[], actions: readonly NceActionRow[], decisions: readonly NceDecisionRow[], recurrence: boolean): NceDossier {
  const of = <T>(type: NceDecisionRow['type']) => decisions.filter((d) => d.type === type).map((d) => ({ decision: d, payload: parseJson<T>(d.payload_json, {} as T) }));
  const patientImpacts: NcePatientImpact[] = of<Omit<NcePatientImpact, 'decidedAt' | 'actorUserId'>>('patient_impact')
    .map(({ decision, payload }) => ({ ...payload, decidedAt: decision.decided_at, actorUserId: decision.actor_user_id }));
  const technicalAssessments: NceTechnicalAssessment[] = of<Omit<NceTechnicalAssessment, 'decidedAt' | 'actorUserId'>>('technical_assessment')
    .map(({ decision, payload }) => ({ ...payload, decidedAt: decision.decided_at, actorUserId: decision.actor_user_id }));
  const releases = of<Omit<NceRelease, 'decidedAt' | 'actorUserId'>>('release');
  const lastRelease = releases.at(-1);
  const release: NceRelease | null = lastRelease ? { ...lastRelease.payload, decidedAt: lastRelease.decision.decided_at, actorUserId: lastRelease.decision.actor_user_id } : null;
  const effectivenessReviews: NceEffectivenessReview[] = of<Omit<NceEffectivenessReview, 'reviewerUserId'>>('effectiveness')
    .map(({ decision, payload }) => ({ ...payload, reviewerUserId: decision.actor_user_id }));
  return {
    status: row.status, source: row.source, testId: row.test_id,
    reportedByUserId: row.reported_by_user_id, ownerUserId: row.owner_user_id, detectedAt: row.detected_at, dueDate: row.due_date,
    description: row.description, correction: row.correction, holdResults: row.hold_results === null ? null : !!row.hold_results,
    containmentNote: row.containment_note, occurredNote: row.occurred_note,
    tier: row.tier, tierReason: row.tier_reason,
    riskSeverity: row.risk_severity, riskProbability: row.risk_probability, riskLevel: row.risk_level, riskBasis: row.risk_basis,
    checklist: parseJson<Record<string, NceChecklistItem>>(row.checklist_json, {}),
    causeStatus: row.cause_status, causeCategory: row.cause_category as NceDossier['causeCategory'], causeText: row.cause_text, causeCheckPlan: row.cause_check_plan,
    effectivenessCriteria: row.effectiveness_criteria, effectivenessReviewDue: row.effectiveness_review_due,
    runs: runs.map((run) => ({ role: run.role as NceRunRole, snapshot: runSnapshotOf(run) })),
    actions: actions.map((a): NceAction => ({
      id: a.id, kind: a.kind, description: a.description, ownerUserId: a.owner_user_id, dueDate: a.due_date,
      status: a.status, doneAt: a.done_at, doneByUserId: a.done_by_user_id, evidence: a.evidence, cancelReason: a.cancel_reason,
    })),
    patientImpacts, technicalAssessments, release, effectivenessReviews, recurrence,
  };
}

/** Trường sửa được của hồ sơ (dạng miền) — để so chênh lệch khi ghi lịch sử. */
export function editableOf(dossier: NceDossier, phase: NceRecordRow['phase']): NceEditable {
  return {
    description: dossier.description, correction: dossier.correction, holdResults: dossier.holdResults, phase,
    containmentNote: dossier.containmentNote, occurredNote: dossier.occurredNote,
    ownerUserId: dossier.ownerUserId, dueDate: dossier.dueDate, tier: dossier.tier, tierReason: dossier.tierReason,
    riskSeverity: dossier.riskSeverity, riskProbability: dossier.riskProbability, riskLevel: dossier.riskLevel, riskBasis: dossier.riskBasis,
    checklist: dossier.checklist, causeStatus: dossier.causeStatus, causeCategory: dossier.causeCategory, causeText: dossier.causeText,
    causeCheckPlan: dossier.causeCheckPlan, effectivenessCriteria: dossier.effectivenessCriteria, effectivenessReviewDue: dossier.effectivenessReviewDue,
  };
}

const COLUMN_OF: Readonly<Record<NceEditableField, keyof RecordColumns>> = {
  description: 'description', correction: 'correction', holdResults: 'hold_results', phase: 'phase', ownerUserId: 'owner_user_id', dueDate: 'due_date',
  containmentNote: 'containment_note', occurredNote: 'occurred_note',
  tier: 'tier', tierReason: 'tier_reason', riskSeverity: 'risk_severity', riskProbability: 'risk_probability', riskLevel: 'risk_level', riskBasis: 'risk_basis',
  checklist: 'checklist_json', causeStatus: 'cause_status', causeCategory: 'cause_category', causeText: 'cause_text', causeCheckPlan: 'cause_check_plan',
  effectivenessCriteria: 'effectiveness_criteria', effectivenessReviewDue: 'effectiveness_review_due',
};

/** Đổi các trường miền đã kiểm sang giá trị cột SQLite. */
export function columnsOfPatch(patch: Partial<NceEditable>): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(patch) as [NceEditableField, unknown][]) {
    const column = COLUMN_OF[key];
    out[column] = key === 'checklist' ? JSON.stringify(value) : key === 'holdResults' ? (value === null ? null : value ? 1 : 0) : value as string | number;
  }
  return out;
}

/** Cập nhật bản ghi chính và tăng `row_version` — chỉ khi phiên bản khớp. Trả
 * `false` nếu bản ghi đã bị người khác sửa (khoá lạc quan). */
export function updateNceRecord(db: Db, id: string, expectedVersion: number, now: string, columns: Record<string, string | number | null> = {}): boolean {
  const names = Object.keys(columns);
  const sets = [...names.map((name) => `${name}=?`), 'row_version=row_version+1', 'updated_at=?'].join(', ');
  const result = db.prepare(`UPDATE nce_records SET ${sets} WHERE id=? AND row_version=?`).run(...names.map((name) => columns[name]), now, id, expectedVersion);
  return Number(result.changes) === 1;
}

export function insertNceDecision(db: Db, recordId: string, type: NceDecisionRow['type'], payload: unknown, actor: NceActorRef, at: string): void {
  db.prepare('INSERT INTO nce_decisions(id,nce_record_id,type,payload_json,actor_user_id,actor_name,decided_at) VALUES (?,?,?,?,?,?,?)')
    .run(uid(), recordId, type, JSON.stringify(payload ?? {}), actor.userId, actor.name || actor.username, at);
}

export function insertNceRevision(db: Db, recordId: string, changes: Record<string, unknown>, actor: NceActorRef, at: string): void {
  db.prepare('INSERT INTO nce_revisions(id,nce_record_id,actor_user_id,actor_name,at,changes_json) VALUES (?,?,?,?,?,?)')
    .run(uid(), recordId, actor.userId, actor.name || actor.username, at, JSON.stringify(changes));
}

export function insertNceRun(db: Db, recordId: string, role: NceRunRole, snapshot: NceRunSnapshot, actor: NceActorRef, at: string): void {
  db.prepare(`INSERT INTO nce_runs(id,nce_record_id,test_id,date,run_id,role,snapshot_json,attached_at,attached_by_user_id,attached_by_name)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid(), recordId, snapshot.testId, snapshot.date, snapshot.runId, role, JSON.stringify(snapshot), at, actor.userId, actor.name || actor.username);
}

export interface NceNewRecord {
  id: string; nceId: string; source: NceDossier['source']; phase: NceRecordRow['phase']; testId: string | null;
  detectedAt: string; description: string; correction: string; holdResults: boolean | null;
  ownerUserId: string; dueDate: string; errorClass: string; checklistJson: string;
}

export function insertNceRecord(db: Db, record: NceNewRecord, actor: NceActorRef, now: string): void {
  db.prepare(`INSERT INTO nce_records(id,nce_id,source,phase,test_id,detected_at,description,correction,hold_results,status,checklist_json,
      owner_user_id,due_date,reported_by_user_id,reported_by_name,error_class,created_at,updated_at,row_version,protocol_version)
    VALUES (?,?,?,?,?,?,?,?,?,'open',?,?,?,?,?,?,?,?,1,4)`)
    .run(record.id, record.nceId, record.source, record.phase, record.testId, record.detectedAt, record.description, record.correction,
      record.holdResults === null ? null : record.holdResults ? 1 : 0, record.checklistJson, record.ownerUserId, record.dueDate,
      actor.userId, actor.name || actor.username, record.errorClass, now, now);
}

/** Hồ sơ chưa đóng, chưa huỷ đang chứa một lần chạy (bất kỳ vai trò nào trừ rerun). */
export function openRecordOfRun(db: Db, testId: string, date: string, runId: string): { id: string; nce_id: string; status: string } | undefined {
  return db.prepare(`SELECT n.id, n.nce_id, n.status FROM nce_runs r JOIN nce_records n ON n.id=r.nce_record_id
    WHERE r.test_id=? AND r.date=? AND r.run_id=? AND r.role<>'rerun' AND n.status NOT IN ('cancelled','closed')
    ORDER BY n.created_at DESC LIMIT 1`).get(testId, date, runId) as { id: string; nce_id: string; status: string } | undefined;
}

/** Hồ sơ không huỷ (kể cả đã đóng) đang chứa một lần chạy hỏng. */
export function recordOfRun(db: Db, testId: string, date: string, runId: string): { id: string; nce_id: string; status: string } | undefined {
  return db.prepare(`SELECT n.id, n.nce_id, n.status FROM nce_runs r JOIN nce_records n ON n.id=r.nce_record_id
    WHERE r.test_id=? AND r.date=? AND r.run_id=? AND r.role<>'rerun' AND n.status<>'cancelled'
    ORDER BY n.created_at DESC LIMIT 1`).get(testId, date, runId) as { id: string; nce_id: string; status: string } | undefined;
}

/** Id điểm bị loại đã được xử lý trọn vẹn (Sigma, D-11). */
export function nceResolvedPointIds(db: Db, testId: string): string[] {
  return (db.prepare(`SELECT DISTINCT p.id FROM qc_points p
    JOIN nce_runs r ON r.test_id=p.test_id AND r.date=p.date AND r.run_id=p.run_id
    JOIN nce_records n ON n.id=r.nce_record_id
    WHERE p.test_id=? AND r.role<>'rerun' AND n.status='closed' AND n.qc_resolved=1
    ORDER BY p.id`).all(testId) as { id: string }[]).map((row) => row.id);
}

/** Cấu hình NCE ở `app_meta` (giá trị hỏng rơi về mặc định). */
export function readNceConfig(db: Db): NceConfig {
  const row = db.prepare("SELECT value FROM app_meta WHERE key='nceConfig'").get() as { value: string } | undefined;
  try { return prepareNceConfig(row ? JSON.parse(row.value) : null); } catch { return prepareNceConfig(null); }
}
