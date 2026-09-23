// IPC handler cho trang Báo cáo: khoá/mở khoá kỳ báo cáo + đọc lại điểm QC
// theo khoảng ngày. Việc dựng tệp (CSV/Excel/PDF) nằm ở renderer qua
// `export:tableXlsx`/`print:htmlToPdf` — xem `docs/APP-PLAN.md` mục 3.8.
import type { Db } from '../db/sqlite-like';
import { uid } from '../domain/text-utils';
import { validateLockPeriod, validateUnlockPeriod, type LockPeriodInput, type UnlockPeriodInput } from '../domain/period-lock-validation';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireAdmin } from './shared';
// Kiểu hàng báo cáo lấy từ HỢP ĐỒNG dùng chung thay vì khai lại ở đây — bản
// trước có hai khai báo song song cùng tên và bản ở đây thiếu cột `lot`.
import type { ReportPointRow } from '../../shared/qc-api';

export type { ReportPointRow };

export interface PeriodLockRow { id: string; ym: string; locked_at: string; locked_by: string; note: string }



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

  /** Điểm QC của 1 xét nghiệm (mọi mức, MỌI lô) trong khoảng ngày.
   *
   * Trả cả điểm ĐÃ HUỶ kèm `void_reason` — báo cáo là hồ sơ, dấu vết huỷ phải
   * còn trong đó, không lọc đi.
   *
   * KHÔNG tính verdict Westgard: đánh giá luật cần cả tập mức cùng lần chạy
   * và thuộc trang Phân tích Westgard (trang đó có bản xuất riêng, kèm cột
   * "Lần chạy bị loại"/"Dùng thống kê"). Quyết định này ghi ở `docs/APP-PLAN.md`
   * mục 3.8. */
  function queryReport(input: { testId?: unknown; from?: unknown; to?: unknown }): ReportPointRow[] {
    const testId = String(input.testId || '');
    const from = String(input.from || '');
    const to = String(input.to || '');
    if (!testId) return [];
    // Liệt kê ĐÚNG các cột hợp đồng khai, không `SELECT *`: hàng báo cáo đi
    // thẳng ra tệp xuất nên không được mang theo cột không ai kiểm.
    let sql = `SELECT id,test_id,level,date,run_id,lot,val,note,operator_name,voided,void_reason
      FROM qc_points WHERE test_id=?`;
    const params: (string | number)[] = [testId];
    if (from) { sql += ' AND date>=?'; params.push(from); }
    if (to) { sql += ' AND date<=?'; params.push(to); }
    sql += ' ORDER BY date, level, run_id';
    return db.prepare(sql).all(...params) as unknown as ReportPointRow[];
  }

  return { listPeriodLocks, isPeriodLocked, lockPeriod, unlockPeriod, queryReport };
}

export type ReportHandlers = ReturnType<typeof createReportHandlers>;
