// IPC handler cho trang Khac phuc su co (NCE/CAPA) - pham vi rut gon: tao ho
// so, duyet/tra lai/huy, danh gia hieu luc. Chua co protocol-v3 FMEA day du,
// chua co gate "khong tu duyet ho so cua chinh minh" (can Users module truoc).
import type { Db } from '../db/open-database';
import { uid } from '../domain/text-utils';
import { validateNceCreate, validateNceReview, type NceCreateInput, type NceReviewInput } from '../domain/nce-validation';
import { type Actor, type IpcResult, nowIso, writeAudit } from './shared';

function todayIso(): string { return nowIso().slice(0, 10); }

export interface NceRecord {
  id: string; date: string; created_at: string; test_id: string | null; level: number | null; lot: string;
  point_id: string | null; rule: string; error_type: string; nce_id: string; protocol_version: number;
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
    const result = validateNceCreate(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { testId, level, lot, date, pointId, rule, errorType, correction, dueDate } = result.data;
    const id = uid();
    const nceId = nextNceId(db, todayIso());
    const now = nowIso();
    db.prepare(`INSERT INTO actions(id,date,created_at,updated_at,created_by_user_id,created_by_username,test_id,level,lot,point_id,rule,error_type,nce_id,protocol_version,approval_status,effectiveness_status,record_status,due_date,detail_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,3,'pending','pending','active',?,?)`)
      .run(id, date, now, now, actor.userId, actor.username, testId || null, level, lot, pointId || null, rule, errorType, nceId, dueDate, JSON.stringify({ correction }));
    writeAudit(db, actor, 'Tao ho so NCE', `Mo ho so ${nceId}`, testId || '');
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  function approve(input: { data: NceReviewInput }, actor: Actor): IpcResult<NceRecord> {
    const result = validateNceReview(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(result.data.id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay ho so.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Ho so da huy, khong the duyet.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'already-approved', message: 'Ho so da duyet truoc do.' } };
    db.prepare("UPDATE actions SET approval_status='approved', updated_at=? WHERE id=?").run(nowIso(), record.id);
    writeAudit(db, actor, 'Duyet ho so NCE', `Duyet ho so ${record.nce_id}`, record.test_id || '');
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(record.id) as unknown as NceRecord };
  }

  function returnForRevision(input: { data: NceReviewInput }, actor: Actor): IpcResult<NceRecord> {
    const result = validateNceReview(input.data, true);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(result.data.id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay ho so.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Ho so da huy.' } };
    const detail = JSON.parse(record.detail_json || '{}');
    detail.returnNote = result.data.note;
    db.prepare("UPDATE actions SET approval_status='returned', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
    writeAudit(db, actor, 'Tra lai ho so NCE', `Ly do: ${result.data.note}`, record.test_id || '');
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(record.id) as unknown as NceRecord };
  }

  function cancel(input: { data: NceReviewInput }, actor: Actor): IpcResult<NceRecord> {
    const result = validateNceReview(input.data, true);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(result.data.id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay ho so.' } };
    if (record.approval_status === 'approved') return { ok: false, error: { code: 'already-approved', message: 'Ho so da duyet khong the huy.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'already-cancelled', message: 'Ho so da huy truoc do.' } };
    const detail = JSON.parse(record.detail_json || '{}');
    detail.cancelReason = result.data.note;
    detail.cancelledBy = actor.name;
    detail.cancelledAt = nowIso();
    db.prepare("UPDATE actions SET record_status='cancelled', updated_at=?, detail_json=? WHERE id=?").run(nowIso(), JSON.stringify(detail), record.id);
    writeAudit(db, actor, 'Huy ho so NCE', `Ly do: ${result.data.note}`, record.test_id || '');
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(record.id) as unknown as NceRecord };
  }

  /** Cong hieu luc chi mo sau khi da co ngay hoan thanh hanh dong - tham
   * khao dung nguyen tac ISO 15189 protocol-v3 cua ban cu (khong don gian
   * hoa bo qua buoc nay). */
  function setActionCompletedDate(input: { data: { id: unknown; actionCompletedDate: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const id = String(input.data.id || '');
    const date = String(input.data.actionCompletedDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: { code: 'invalid-date', message: 'Ngay hoan thanh khong hop le.' } };
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay ho so.' } };
    db.prepare('UPDATE actions SET action_completed_date=?, updated_at=? WHERE id=?').run(date, nowIso(), id);
    writeAudit(db, actor, 'Cap nhat ngay hoan thanh NCE', `Ho so ${record.nce_id}: ${date}`, record.test_id || '');
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  function markEffectiveness(input: { data: { id: unknown; status: 'effective' | 'ineffective'; note?: unknown } }, actor: Actor): IpcResult<NceRecord> {
    const id = String(input.data.id || '');
    const record = db.prepare('SELECT * FROM actions WHERE id=?').get(id) as NceRecord | undefined;
    if (!record) return { ok: false, error: { code: 'not-found', message: 'Khong tim thay ho so.' } };
    if (record.record_status === 'cancelled') return { ok: false, error: { code: 'cancelled', message: 'Ho so da huy.' } };
    if (!record.action_completed_date) {
      return { ok: false, error: { code: 'missing-completed-date', message: 'Can nhap ngay hoan thanh hanh dong truoc khi danh gia hieu luc.' } };
    }
    const detail = JSON.parse(record.detail_json || '{}');
    if (input.data.note) detail.effectivenessNote = String(input.data.note);
    db.prepare("UPDATE actions SET effectiveness_status=?, updated_at=?, detail_json=? WHERE id=?").run(input.data.status, nowIso(), JSON.stringify(detail), id);
    writeAudit(db, actor, 'Danh gia hieu luc NCE', `Ho so ${record.nce_id}: ${input.data.status}`, record.test_id || '');
    return { ok: true, data: db.prepare('SELECT * FROM actions WHERE id=?').get(id) as unknown as NceRecord };
  }

  return { listRecords, create, approve, returnForRevision, cancel, setActionCompletedDate, markEffectiveness };
}

export type NceHandlers = ReturnType<typeof createNceHandlers>;
