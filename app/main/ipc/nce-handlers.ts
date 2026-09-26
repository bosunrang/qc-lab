// IPC handler cho NCE/CAPA. `detail_json` giữ protocol-v3 (FMEA, checklist,
// kiểm soát, tác động bệnh nhân) vì các trường đó luôn được đọc/ghi nguyên
// một hồ sơ; các cột thật của `actions` dành cho danh sách, lọc và audit.
import type { Db } from '../db/sqlite-like';
import { cleanId, cleanText, uid } from '../domain/text-utils';
import { normalizeErrorClass } from '../domain/westgard-rules';
import {
  nceApprovalReadiness, prepareNceProtocol, validateNceCreate, validateNceReview, validateReleaseDecision, validateRerunEvidence, validateResidualRisk,
  type PreparedNceProtocol,
} from '../domain/nce-validation';
import { nextNceId } from '../db/nce-ids';
import { nceOverdueDays } from '../domain/nce-overdue';
import { isoLocalDate } from '../domain/local-date';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireWrite, withTransaction } from './shared';

function todayIso(): string { return nowIso().slice(0, 10); }
function objectInput(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function parseDetail(json: string): Record<string, unknown> { try { return objectInput(JSON.parse(json || '{}')); } catch { return {}; } }
function validDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}$/.test(value); }

// Nguồn DUY NHẤT là `shared/qc-api.d.ts` — trước 2026-09-10 file này khai
// một `NceRecord` riêng dùng `string` cho 3 trường trạng thái, trong khi hợp
// đồng khai union; và hợp đồng lại thiếu `created_by_user_id`/`risk_level`
// mà file này có. Hai khai báo song song, lệch theo hai chiều ngược nhau.
import type { NceRecord } from '../../shared/qc-api';

export type { NceRecord };

function protocolOf(record: NceRecord, extra?: unknown): PreparedNceProtocol {
  const detail = { ...parseDetail(record.detail_json), ...objectInput(extra) };
  return prepareNceProtocol({ ...detail, actionCompletedDate: record.action_completed_date || detail.actionCompletedDate, effectivenessStatus: record.effectiveness_status || detail.effectivenessStatus });
}
function protocolJson(protocol: PreparedNceProtocol, previous: Record<string, unknown>): string {
  return JSON.stringify({ ...previous, ...protocol });
}

export function createNceHandlers(db: Db) {
  /** Kèm `overdue_days` do main tính theo ngày giờ địa phương của máy chính —
   * nguồn duy nhất của quy tắc quá hạn (`domain/nce-overdue.ts`). */
  function withOverdue(row: Omit<NceRecord, 'overdue_days'>, today: string): NceRecord {
    return { ...row, overdue_days: nceOverdueDays(row, today) };
  }
  function listRecords(): NceRecord[] {
    const today = isoLocalDate();
    return (db.prepare('SELECT * FROM actions ORDER BY created_at DESC').all() as unknown as Omit<NceRecord, 'overdue_days'>[]).map((row) => withOverdue(row, today));
  }
  function get(id: string): NceRecord | undefined {
    const row = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as Omit<NceRecord, 'overdue_days'> | undefined;
    return row ? withOverdue(row, isoLocalDate()) : undefined;
  }
  function result(record: NceRecord): IpcResult<NceRecord> { return { ok: true, data: get(record.id)! }; }
  function changed(record: NceRecord): void { notifyChanged(['actions'], record.test_id ? [record.test_id] : []); }

  function create(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const body = objectInput(input); const validated = validateNceCreate(objectInput(body.data));
    if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const v = validated.data;
    const protocol = prepareNceProtocol({ ...v.protocol, correction: v.correction, investigation: v.investigation, causeCategory: v.causeCategory, cause: v.causeDescription });
    const id = uid(), nceId = nextNceId(db, todayIso()), now = nowIso();
    withTransaction(db, () => {
      db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,nce_id,protocol_version,approval_status,effectiveness_status,record_status,risk_level,due_date,action_completed_date,detail_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?,?,?)`)
        .run(id, v.date, now, now, actor.userId, actor.username, v.testId || null, v.level, v.lot, v.pointId || null, v.rule, normalizeErrorClass(v.errorType), nceId, protocol.riskLevel, v.dueDate, '', protocolJson(protocol, {}));
      writeAudit(db, actor, 'Tạo hồ sơ NCE', `Mở hồ sơ ${nceId} · đang điều tra`, v.testId || '');
    });
    const record = get(id)!; changed(record);
    return result(record);
  }

  /** Lưu toàn bộ protocol ở trạng thái đang điều tra. Người lập có thể hoàn
   * thiện theo từng bước; chỉ phê duyệt mới yêu cầu khép vòng đầy đủ. */
  function saveProtocol(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const data = objectInput(objectInput(input).data), id = cleanId(data.id);
    if (!id) return { ok: false, error: { code: 'missing-id', message: 'Thiếu mã hồ sơ.' } };
    const record = get(id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy chỉ được xem, không thể sửa.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'approved', message: 'Hồ sơ đã duyệt không thể sửa; hãy mở NCE mới nếu sự cố tái diễn.' } };
    const current = parseDetail(record.detail_json), protocol = protocolOf(record, data.protocol);
    const dueDate = cleanText(data.dueDate ?? record.due_date, 20).trim();
    if (dueDate && !validDate(dueDate)) return { ok: false, error: { code: 'invalid-due-date', message: 'Hạn hoàn thành không hợp lệ.' } };
    if (dueDate && dueDate < record.date) return { ok: false, error: { code: 'due-before-date', message: 'Hạn hoàn thành không được trước ngày ghi nhận sự cố.' } };
    if (protocol.actionCompletedDate && !validDate(protocol.actionCompletedDate)) return { ok: false, error: { code: 'invalid-completed-date', message: 'Ngày hoàn thành hành động không hợp lệ.' } };
    withTransaction(db, () => {
      db.prepare('UPDATE actions SET due_date=?, action_completed_date=?, effectiveness_status=?, risk_level=?, approval_status=?, updated_at=?, detail_json=? WHERE id=?')
        .run(dueDate, protocol.actionCompletedDate, protocol.effectivenessStatus, protocol.riskLevel, record.approval_status === 'returned' ? 'pending' : record.approval_status, nowIso(), protocolJson(protocol, current), id);
      writeAudit(db, actor, 'Cập nhật hồ sơ NCE', `${record.nce_id} · đang điều tra`, record.test_id || '');
    });
    const saved = get(id)!; changed(saved);
    return result(saved);
  }

  function approvalReadiness(record: NceRecord): { ok: boolean; missing: string[] } {
    const detail = parseDetail(record.detail_json), protocol = protocolOf(record);
    return nceApprovalReadiness({ date: record.date, dueDate: record.due_date, actionCompletedDate: record.action_completed_date, effectivenessStatus: record.effectiveness_status, followUpNceId: record.follow_up_nce_id, protocol, hasAcceptedRerun: !!detail.rerunPointId }, todayIso());
  }

  function approve(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const validated = validateNceReview(objectInput(objectInput(input).data));
    if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const record = get(validated.data.id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy, không thể duyệt.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'already-approved', message: 'Hồ sơ đã duyệt trước đó.' } };
    if (record.created_by_user_id && record.created_by_user_id === actor.userId) return { ok: false, error: { code: 'self-approval', message: 'Người lập hoặc người đã tham gia xử lý không được tự phê duyệt hồ sơ NCE.' } };
    const ready = approvalReadiness(record);
    if (!ready.ok) return { ok: false, error: { code: 'protocol-incomplete', message: `Hồ sơ chưa đủ điều kiện khép vòng: ${ready.missing.join(', ')}.` } };
    const detail = parseDetail(record.detail_json); Object.assign(detail, { approvedBy: actor.name, approvedAt: nowIso() });
    withTransaction(db, () => {
      db.prepare("UPDATE actions SET approval_status='approved', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
      writeAudit(db, actor, 'Duyệt hồ sơ NCE', `Duyệt hồ sơ ${record.nce_id}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function returnForRevision(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const validated = validateNceReview(objectInput(objectInput(input).data), true);
    if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const record = get(validated.data.id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy.' } };
    const detail = parseDetail(record.detail_json); Object.assign(detail, { returnNote: validated.data.note, returnBy: actor.name, returnAt: nowIso() });
    withTransaction(db, () => {
      db.prepare("UPDATE actions SET approval_status='returned', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
      writeAudit(db, actor, 'Trả lại hồ sơ NCE', `Lý do: ${validated.data.note}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function cancel(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const validated = validateNceReview(objectInput(objectInput(input).data), true);
    if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const record = get(validated.data.id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'already-approved', message: 'Hồ sơ đã duyệt không thể hủy.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'already-cancelled', message: 'Hồ sơ đã hủy trước đó.' } };
    const detail = parseDetail(record.detail_json); Object.assign(detail, { cancelReason: validated.data.note, cancelledBy: actor.name, cancelledAt: nowIso() });
    withTransaction(db, () => {
      db.prepare("UPDATE actions SET record_status='cancelled', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
      writeAudit(db, actor, 'Hủy hồ sơ NCE', `Lý do: ${validated.data.note}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function setActionCompletedDate(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const data = objectInput(objectInput(input).data), id = cleanId(data.id), date = cleanText(data.actionCompletedDate, 20).trim();
    if (!validDate(date)) return { ok: false, error: { code: 'invalid-date', message: 'Ngày hoàn thành không hợp lệ.' } };
    const record = get(id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (date < record.date || date > todayIso()) return { ok: false, error: { code: 'invalid-date-order', message: 'Ngày hoàn thành phải sau ngày sự cố và không ở tương lai.' } };
    const detail = parseDetail(record.detail_json); detail.actionCompletedDate = date;
    withTransaction(db, () => {
      db.prepare('UPDATE actions SET action_completed_date=?, updated_at=?, detail_json=? WHERE id=?').run(date, nowIso(), JSON.stringify(detail), id);
      writeAudit(db, actor, 'Cập nhật ngày hoàn thành NCE', `Hồ sơ ${record.nce_id}: ${date}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function markEffectiveness(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const data = objectInput(objectInput(input).data), id = cleanId(data.id), record = get(id);
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy.' } };
    if (!record.action_completed_date) return { ok: false, error: { code: 'missing-completed-date', message: 'Cần nhập ngày hoàn thành hành động trước khi đánh giá hiệu lực.' } };
    const validated = validateResidualRisk(data); if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const detail = parseDetail(record.detail_json); Object.assign(detail, { effectivenessStatus: validated.data.status, effectivenessDate: todayIso(), effectivenessNote: validated.data.note || detail.effectivenessNote || '', residualRisk: validated.data.residualRisk || detail.residualRisk || '' });
    withTransaction(db, () => {
      db.prepare('UPDATE actions SET effectiveness_status=?, updated_at=?, detail_json=? WHERE id=?').run(validated.data.status, nowIso(), JSON.stringify(detail), id);
      writeAudit(db, actor, 'Đánh giá hiệu lực NCE', `Hồ sơ ${record.nce_id}: ${validated.data.status}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function setReleaseDecision(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const validated = validateReleaseDecision(objectInput(objectInput(input).data)); if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const record = get(validated.data.id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy.' } };
    const detail = parseDetail(record.detail_json); Object.assign(detail, { releaseDecision: validated.data.decision, releaseStatus: validated.data.decision === 'released' ? 'released' : '', releaseNote: validated.data.note, releaseDate: todayIso(), releaseBy: actor.name, releaseDecidedAt: nowIso(), releaseDecidedBy: actor.name });
    withTransaction(db, () => {
      db.prepare('UPDATE actions SET updated_at=?, detail_json=? WHERE id=?').run(nowIso(), JSON.stringify(detail), record.id);
      writeAudit(db, actor, 'Quyết định release-to-service', `Hồ sơ ${record.nce_id}: ${validated.data.decision}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function setRerunEvidence(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const validated = validateRerunEvidence(objectInput(objectInput(input).data)); if (!validated.ok) return { ok: false, error: { code: validated.code, message: validated.message } };
    const record = get(validated.data.id); if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy.' } };
    const point = db.prepare('SELECT id, test_id, level, date, run_id, val FROM qc_points WHERE id=? AND voided=0').get(validated.data.rerunPointId) as { id: string; test_id: string; level: number; date: string; run_id: string; val: number } | undefined;
    if (!point) return { ok: false, error: { code: 'point-not-found', message: 'Không tìm thấy điểm QC rerun hợp lệ.' } };
    if (record.test_id && point.test_id !== record.test_id) return { ok: false, error: { code: 'point-wrong-test', message: 'Điểm QC rerun phải cùng xét nghiệm với hồ sơ NCE.' } };
    if (point.date < record.date) return { ok: false, error: { code: 'point-too-early', message: 'Điểm QC rerun phải được chạy sau khi xảy ra sự cố.' } };
    const detail = parseDetail(record.detail_json); Object.assign(detail, { rerunPointId: point.id, rerunNote: validated.data.note, rerunSnapshot: { date: point.date, runId: point.run_id, val: point.val, level: point.level } });
    withTransaction(db, () => {
      db.prepare('UPDATE actions SET updated_at=?, detail_json=? WHERE id=?').run(nowIso(), JSON.stringify(detail), record.id);
      writeAudit(db, actor, 'Gắn bằng chứng rerun NCE', `Hồ sơ ${record.nce_id}: điểm ${point.date} lần ${point.run_id}`, record.test_id || '');
    });
    changed(record);
    return result(record);
  }

  function reopenNce(input: unknown, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const data = objectInput(objectInput(input).data), id = cleanId(data.id), record = get(id);
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã hủy, không thể mở lại.' } };
    if (record.effectiveness_status !== 'ineffective') return { ok: false, error: { code: 'not-ineffective', message: 'Chỉ mở vòng tiếp theo khi hành động đã bị kết luận không hiệu quả.' } };
    if (record.follow_up_nce_id) return { ok: false, error: { code: 'already-reopened', message: 'Hồ sơ này đã có vòng tiếp theo, mở tiếp từ vòng đó.' } };
    const newId = uid(), nceId = nextNceId(db, todayIso()), now = nowIso(), prior = protocolOf(record);
    const inherited = { ...prior, correction: '', cause: '', action: '', actionCompletedDate: '', effectivenessStatus: 'pending', effectivenessDate: '', effectivenessNote: '', residualSeverity: 0, residualOccurrence: 0, residualDetectability: 0, residualRiskLevel: '', residualRiskBasis: '' };
    // Hồ sơ mới và liên kết từ hồ sơ cũ là một đơn vị: thiếu một trong hai là
    // chuỗi vòng NCE bị đứt.
    withTransaction(db, () => {
      db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,nce_id,parent_nce_id,protocol_version,approval_status,effectiveness_status,record_status,risk_level,due_date,action_completed_date,detail_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?,?,?)`)
        .run(newId, now.slice(0, 10), now, now, actor.userId, actor.username, record.test_id, record.level, record.lot, record.point_id, record.rule, normalizeErrorClass(record.error_type), nceId, record.nce_id, inherited.riskLevel, record.due_date, '', JSON.stringify({ ...inherited, reopenedFrom: record.nce_id, reopenNote: cleanText(data.note, 2000).trim() }));
      db.prepare('UPDATE actions SET follow_up_nce_id=?, updated_at=? WHERE id=?').run(newId, now, id);
      writeAudit(db, actor, 'Mở vòng tiếp theo NCE', `Từ hồ sơ ${record.nce_id} sang ${nceId}`, record.test_id || '');
    });
    const fresh = get(newId)!; changed(fresh);
    return result(fresh);
  }

  return { listRecords, create, saveProtocol, approve, returnForRevision, cancel, setActionCompletedDate, markEffectiveness, setReleaseDecision, setRerunEvidence, reopenNce };
}

export type NceHandlers = ReturnType<typeof createNceHandlers>;


