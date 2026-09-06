// IPC handler cho trang Khac phuc su co (NCE/CAPA) - pham vi rut gon: tao ho
// so, duyet/tra lai/huy, danh gia hieu luc. Chua co protocol-v3 FMEA day du,
// chua co gate "khong tu duyet ho so cua chinh minh" (can Users module truoc).
import type { Db } from '../db/open-database';
import { uid } from '../domain/text-utils';
import {
  validateNceCreate, validateNceReview, validateReleaseDecision, validateRerunEvidence, validateResidualRisk,
  type NceCreateInput, type NceReviewInput,
} from '../domain/nce-validation';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireWrite } from './shared';

function todayIso(): string { return nowIso().slice(0, 10); }

export interface NceRecord {
  id: string; date: string; created_at: string; test_id: string | null; level: number | null; lot: string;
  point_id: string | null; rule: string; error_type: string; nce_id: string; parent_nce_id: string; follow_up_nce_id: string; protocol_version: number;
  approval_status: string; effectiveness_status: string; record_status: string; due_date: string;
  action_completed_date: string; detail_json: string;
}

function nextNceId(db: Db, today: string): string {
  const prefix = `NCE-${today.replace(/-/g, '')}`;
  const row = db.prepare("SELECT COUNT(*) as c FROM actions WHERE nce_id LIKE ?").get(prefix + '%') as { c: number };
  return `${prefix}-${String(row.c + 1).padStart(2, '0')}`;
}

export function createNceHandlers(db: Db) {
  function listRecords(): NceRecord[] {
    return db.prepare('SELECT * FROM actions ORDER BY created_at DESC').all() as unknown as NceRecord[];
  }

  function create(input: { data: NceCreateInput }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateNceCreate(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { testId, level, lot, date, pointId, rule, errorType, correction, dueDate, investigation, causeCategory, causeDescription } = result.data;
    const id = uid();
    const nceId = nextNceId(db, todayIso());
    const now = nowIso();
    db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,nce_id,protocol_version,approval_status,effectiveness_status,record_status,due_date,detail_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?)`)
      .run(id, date, now, now, actor.userId, actor.username, testId || null, level, lot, pointId || null, rule, errorType, nceId, dueDate,
        JSON.stringify({ correction, investigation, causeCategory, causeDescription }));
    writeAudit(db, actor, 'Tạo hồ sơ NCE', `Mở hồ sơ ${nceId}`, testId || '');
    notifyChanged(['actions'], testId ? [testId] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  function approve(input: { data: NceReviewInput }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateNceReview(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(result.data.id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã huỷ, không thể duyệt.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'already-approved', message: 'Hồ sơ đã duyệt trước đó.' } };
    db.prepare("UPDATE actions SET approval_status='approved', updated_at=? WHERE id=?").run(nowIso(), record.id);
    writeAudit(db, actor, 'Duyệt hồ sơ NCE', `Duyệt hồ sơ ${record.nce_id}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(record.id) as unknown as NceRecord };
  }

  function returnForRevision(input: { data: NceReviewInput }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateNceReview(input.data, true);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(result.data.id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã huỷ.' } };
    const detail = JSON.parse(record.detail_json || '{}');
    detail.returnNote = result.data.note;
    db.prepare("UPDATE actions SET approval_status='returned', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
    writeAudit(db, actor, 'Trả lại hồ sơ NCE', `Lý do: ${result.data.note}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(record.id) as unknown as NceRecord };
  }

  function cancel(input: { data: NceReviewInput }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateNceReview(input.data, true);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(result.data.id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'already-approved', message: 'Hồ sơ đã duyệt không thể huỷ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'already-cancelled', message: 'Hồ sơ đã huỷ trước đó.' } };
    const detail = JSON.parse(record.detail_json || '{}');
    detail.cancelReason = result.data.note;
    detail.cancelledBy = actor.name;
    detail.cancelledAt = nowIso();
    db.prepare("UPDATE actions SET record_status='cancelled', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
    writeAudit(db, actor, 'Hủy hồ sơ NCE', `Lý do: ${result.data.note}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(record.id) as unknown as NceRecord };
  }

  /** Cong hieu luc chi mo sau khi da co ngay hoan thanh hanh dong - tham
   * khao dung nguyen tac ISO 15189 protocol-v3 cua ban cu (khong don gian
   * hoa bo qua buoc nay). */
  function setActionCompletedDate(input: { data: { id: unknown; actionCompletedDate: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const id = String(input.data.id || '');
    const date = String(input.data.actionCompletedDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: { code: 'invalid-date', message: 'Ngày hoàn thành không hợp lệ.' } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    db.prepare('UPDATE actions SET action_completed_date=?, updated_at=? WHERE id=?').run(date, nowIso(), id);
    writeAudit(db, actor, 'Cập nhật ngày hoàn thành NCE', `Hồ sơ ${record.nce_id}: ${date}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  function markEffectiveness(input: { data: { id: unknown; status: 'effective' | 'ineffective'; residualRisk?: unknown; note?: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const id = String(input.data.id || '');
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã huỷ.' } };
    if (!record.action_completed_date) {
      return { ok: false, error: { code: 'missing-completed-date', message: 'Cần nhập ngày hoàn thành hành động trước khi đánh giá hiệu lực.' } };
    }
    // Cong nay CHỈ kiểm tra sau khi 2 cổng phụ thuộc trạng thái hồ sơ ở trên
    // đã qua — báo "thiếu ngày hoàn thành" trước "thiếu đánh giá rủi ro"
    // đúng thứ tự thao tác thật (không thể đánh giá rủi ro cho hồ sơ còn
    // chưa đủ điều kiện đánh giá hiệu lực).
    const result = validateResidualRisk(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { status, residualRisk, note } = result.data;
    const detail = JSON.parse(record.detail_json || '{}');
    if (note) detail.effectivenessNote = note;
    if (residualRisk) detail.residualRisk = residualRisk;
    db.prepare("UPDATE actions SET effectiveness_status=?, updated_at=?, detail_json=? WHERE id=?").run(status, nowIso(), JSON.stringify(detail), id);
    writeAudit(db, actor, 'Đánh giá hiệu lực NCE', `Hồ sơ ${record.nce_id}: ${status}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  /** Quyết định release-to-service — dùng khi kết quả bệnh nhân đang bị giữ
   * lại chờ xử lý QC. Không đổi trạng thái duyệt/hiệu lực, chỉ ghi lại quyết
   * định + lý do vào detail_json (đúng phạm vi rút gọn: chưa có luồng khoá
   * kết quả bệnh nhân thật, chỉ ghi nhận quyết định để truy xuất). */
  function setReleaseDecision(input: { data: { id: unknown; decision: 'held' | 'released'; note: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateReleaseDecision(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { id, decision, note } = result.data;
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã huỷ.' } };
    const detail = JSON.parse(record.detail_json || '{}');
    detail.releaseDecision = decision;
    detail.releaseNote = note;
    detail.releaseDecidedAt = nowIso();
    detail.releaseDecidedBy = actor.name;
    db.prepare('UPDATE actions SET updated_at=?, detail_json=? WHERE id=?').run(nowIso(), JSON.stringify(detail), id);
    writeAudit(db, actor, 'Quyết định release-to-service', `Hồ sơ ${record.nce_id}: ${decision}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  /** Liên kết bằng chứng rerun tới 1 điểm QC THẬT (không phải mô tả tự do) —
   * xác nhận điểm đó tồn tại và (nếu hồ sơ có gắn xét nghiệm) đúng xét
   * nghiệm, tránh trỏ nhầm bằng chứng sang xét nghiệm khác. */
  function setRerunEvidence(input: { data: { id: unknown; rerunPointId: unknown; note?: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const result = validateRerunEvidence(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { id, rerunPointId, note } = result.data;
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã huỷ.' } };
    const point = db.prepare('SELECT id, test_id, level, date, run_id, val FROM qc_points WHERE id=?').get(rerunPointId) as
      { id: string; test_id: string; level: number; date: string; run_id: string; val: number } | undefined;
    if (!point) return { ok: false, error: { code: 'point-not-found', message: 'Không tìm thấy điểm QC rerun.' } };
    if (record.test_id && point.test_id !== record.test_id) {
      return { ok: false, error: { code: 'point-wrong-test', message: 'Điểm QC rerun phải cùng xét nghiệm với hồ sơ NCE.' } };
    }
    const detail = JSON.parse(record.detail_json || '{}');
    detail.rerunPointId = rerunPointId;
    detail.rerunNote = note;
    detail.rerunSnapshot = { date: point.date, runId: point.run_id, val: point.val, level: point.level };
    db.prepare('UPDATE actions SET updated_at=?, detail_json=? WHERE id=?').run(nowIso(), JSON.stringify(detail), id);
    writeAudit(db, actor, 'Gắn bằng chứng rerun NCE', `Hồ sơ ${record.nce_id}: điểm ${point.date} lần ${point.run_id}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  /** Mở vòng NCE tiếp theo khi hồ sơ đã kết luận "không hiệu quả" — tạo BẢN
   * GHI MỚI (không sửa lại bản cũ), liên kết `parent_nce_id`/`follow_up_nce_id`
   * — tham khảo `action-escalation-service.ts`'s `createFollowUp()` bản cũ.
   * Chặn mở vòng thứ 2 nếu vòng trước đã có follow-up rồi (mỗi hồ sơ chỉ mở
   * đúng 1 vòng tiếp theo, muốn mở nữa phải làm từ vòng follow-up đó). */
  function reopenNce(input: { data: { id: unknown; note?: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const denied = requireWrite(actor); if (denied) return denied;
    const id = String(input.data.id || '');
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy hồ sơ.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Hồ sơ đã huỷ, không thể mở lại.' } };
    if (record.effectiveness_status !== 'ineffective') {
      return { ok: false, error: { code: 'not-ineffective', message: 'Chỉ mở vòng tiếp theo khi hành động đã bị kết luận không hiệu quả.' } };
    }
    if (record.follow_up_nce_id) {
      return { ok: false, error: { code: 'already-reopened', message: 'Hồ sơ này đã có vòng tiếp theo, mở tiếp từ vòng đó.' } };
    }
    const newId = uid();
    const nceId = nextNceId(db, todayIso());
    const now = nowIso();
    const detail = JSON.parse(record.detail_json || '{}');
    db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,nce_id,parent_nce_id,protocol_version,approval_status,effectiveness_status,record_status,due_date,detail_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?)`)
      .run(newId, now.slice(0, 10), now, now, actor.userId, actor.username, record.test_id, record.level, record.lot, record.point_id,
        record.rule, record.error_type, nceId, record.nce_id, record.due_date,
        JSON.stringify({ correction: '', reopenedFrom: record.nce_id, reopenNote: String(input.data.note || '') }));
    db.prepare('UPDATE actions SET follow_up_nce_id=?, updated_at=? WHERE id=?').run(newId, now, id);
    writeAudit(db, actor, 'Mở vòng tiếp theo NCE', `Từ hồ sơ ${record.nce_id} sang ${nceId}`, record.test_id || '');
    notifyChanged(['actions'], record.test_id ? [record.test_id] : []);
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(newId) as unknown as NceRecord };
  }

  return {
    listRecords, create, approve, returnForRevision, cancel, setActionCompletedDate, markEffectiveness,
    setReleaseDecision, setRerunEvidence, reopenNce,
  };
}

export type NceHandlers = ReturnType<typeof createNceHandlers>;
