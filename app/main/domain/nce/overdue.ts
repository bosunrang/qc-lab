// Quá hạn của hồ sơ NCE và của từng hành động — tính ở main theo ngày địa
// phương (D-13). Thay `domain/nce-overdue.ts` khi chuyển sang mô hình mới: hồ
// sơ tự mở khi huỷ điểm giờ luôn có người phụ trách nên không còn lọt khỏi
// cảnh báo quá hạn (sửa R-11).
import type { NceAction, NceStatus } from './types';
import { cleanDate } from './format';

function daysBetween(from: string, to: string): number {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/** Số ngày quá hạn của hồ sơ; 0 khi chưa quá hạn, đã đóng hoặc đã huỷ. Đến
 * hạn đúng hôm nay chưa phải quá hạn. Hồ sơ chờ duyệt vẫn tính: chậm duyệt
 * cũng là chậm khép hồ sơ. */
export function nceRecordOverdueDays(record: { status: NceStatus; dueDate: string }, today: string): number {
  if (record.status === 'closed' || record.status === 'cancelled') return 0;
  const due = cleanDate(record.dueDate);
  return due && due < today ? daysBetween(due, today) : 0;
}

export function nceActionOverdueDays(action: Pick<NceAction, 'status' | 'dueDate'>, today: string): number {
  if (action.status !== 'open') return 0;
  const due = cleanDate(action.dueDate);
  return due && due < today ? daysBetween(due, today) : 0;
}
