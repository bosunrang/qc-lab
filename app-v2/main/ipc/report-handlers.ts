// IPC handler cho trang Bao cao: khoa/mo khoa ky bao cao + xem lai diem QC
// theo khoang ngay. Pham vi rut gon: chua co in an/xuat Excel/CSV nhu ban cu
// (xem CLAUDE.md "con thieu") - chi co bang xem va khoa ky.
import type { Db } from '../db/sqlite-like';
import { uid } from '../domain/text-utils';
import { validateLockPeriod, validateUnlockPeriod, type LockPeriodInput, type UnlockPeriodInput } from '../domain/period-lock-validation';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireAdmin } from './shared';

export interface PeriodLockRow { id: string; ym: string; locked_at: string; locked_by: string; note: string }

export interface ReportPointRow {
  id: string; test_id: string; level: number; date: string; run_id: string; val: number;
  note: string; operator_name: string; voided: 0 | 1; void_reason: string;
}

export function createReportHandlers(db: Db) {
  function listPeriodLocks(): PeriodLockRow[] {
    return db.prepare('SELECT * FROM period_locks ORDER BY ym DESC').all() as unknown as PeriodLockRow[];
  }

  function isPeriodLocked(ym: string): boolean {
    return !!db.prepare('SELECT id FROM period_locks WHERE ym=?').get(ym);
  }

  function lockPeriod(input: { data: LockPeriodInput }, actor: Actor): IpcResult<PeriodLockRow> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const result = validateLockPeriod(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { ym, note } = result.data;
    if (isPeriodLocked(ym)) return { ok: false, error: { code: 'already-locked', message: `Kỳ ${ym} đã được khoá trước đó.` } };
    const id = uid();
    db.prepare('INSERT INTO period_locks(id,ym,locked_at,locked_by,note) VALUES (?,?,?,?,?)').run(id, ym, nowIso(), actor.username, note);
    writeAudit(db, actor, 'Khoá kỳ báo cáo', `Khoá kỳ ${ym}${note ? ': ' + note : ''}`, ym);
    notifyChanged(['period_locks']);
    return { ok: true, data: db.prepare('SELECT * FROM period_locks WHERE id=?').get(id) as unknown as PeriodLockRow };
  }

  function unlockPeriod(input: { data: UnlockPeriodInput }, actor: Actor): IpcResult<{ ym: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const result = validateUnlockPeriod(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { ym, note } = result.data;
    if (!isPeriodLocked(ym)) return { ok: false, error: { code: 'not-locked', message: `Kỳ ${ym} chưa bị khoá.` } };
    db.prepare('DELETE FROM period_locks WHERE ym=?').run(ym);
    writeAudit(db, actor, 'Mở khoá kỳ báo cáo', `Mở khoá kỳ ${ym}: ${note}`, ym);
    notifyChanged(['period_locks']);
    return { ok: true, data: { ym } };
  }

  /** Xem lại điểm QC của 1 xét nghiệm (mọi mức) trong khoảng ngày — dùng cho
   * bảng xem lại của trang Báo cáo, không tính verdict Westgard (đó là việc
   * của trang Phân tích Westgard, xem "Confirmed business-logic decisions"
   * trong CLAUDE.md — 2 con số Sigma/verdict của Báo cáo và Westgard cố ý
   * tách biệt). */
  function queryReport(input: { testId?: unknown; from?: unknown; to?: unknown }): ReportPointRow[] {
    const testId = String(input.testId || '');
    const from = String(input.from || '');
    const to = String(input.to || '');
    if (!testId) return [];
    let sql = 'SELECT * FROM qc_points WHERE test_id=?';
    const params: (string | number)[] = [testId];
    if (from) { sql += ' AND date>=?'; params.push(from); }
    if (to) { sql += ' AND date<=?'; params.push(to); }
    sql += ' ORDER BY date, level, run_id';
    return db.prepare(sql).all(...params) as unknown as ReportPointRow[];
  }

  return { listPeriodLocks, isPeriodLocked, lockPeriod, unlockPeriod, queryReport };
}

export type ReportHandlers = ReturnType<typeof createReportHandlers>;
