// Cổng khoá kỳ báo cáo — nguồn DUY NHẤT cho mọi handler cần biết một kỳ
// (YYYY-MM) đã khoá chưa: Nhập QC chặn thêm/huỷ điểm và sửa ghi chú, Cấu hình
// chung chặn đổi dữ liệu thuộc kỳ đã khoá, Báo cáo khoá/mở khoá kỳ. Trước
// 2026-09-26 mỗi handler tự viết một bản, cùng mẫu với `operational-levels.ts`.
import type { Db } from './sqlite-like';
import { ymOfDate } from '../domain/period-lock-validation';

/** Kỳ `ym` (YYYY-MM) đã khoá chưa. Khoá áp cho mọi xét nghiệm. */
export function isPeriodLocked(db: Db, ym: string): boolean {
  return !!db.prepare('SELECT id FROM period_locks WHERE ym=?').get(ym);
}

/** Ngày `date` (YYYY-MM-DD) có thuộc một kỳ đã khoá không. */
export function isDateInLockedPeriod(db: Db, date: string): boolean {
  return isPeriodLocked(db, ymOfDate(date));
}
