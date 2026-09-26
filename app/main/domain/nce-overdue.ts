// Quy tắc "hồ sơ NCE quá hạn" — nguồn DUY NHẤT (kế hoạch kiến trúc F.2).
// Trước 2026-09-26 quy tắc này chỉ nằm ở view-model của Tổng quan; nay main
// tính và trả `overdue_days` trong `listNceRecords`, renderer chỉ hiển thị.
import type { NceRecord } from '../../shared/qc-api';

type OverdueInput = Pick<NceRecord, 'due_date' | 'record_status' | 'approval_status' | 'detail_json'>;

/** Người phụ trách ghi trong hồ sơ; chuỗi rỗng khi chưa ghi hoặc JSON hỏng. */
export function nceOwner(record: Pick<NceRecord, 'detail_json'> | null | undefined): string {
  try { return String((JSON.parse(record?.detail_json || '{}') as { owner?: unknown }).owner || '').trim(); } catch { return ''; }
}

/** Số ngày quá hạn tính đến `today` (YYYY-MM-DD, giờ địa phương); 0 khi chưa
 * quá hạn. Chỉ hồ sơ đã ghi thật (có người phụ trách và xử lý tức thời từ 5
 * ký tự) mà chưa khép vòng mới tính: huỷ hoặc đã phê duyệt thì không; bị trả
 * lại vẫn tính. Đến hạn đúng hôm nay chưa phải quá hạn. */
export function nceOverdueDays(record: OverdueInput | null | undefined, today: string): number {
  if (!record) return 0;
  let correction = '';
  try { correction = String((JSON.parse(record.detail_json || '{}') as { correction?: unknown }).correction || '').trim(); } catch { /* dữ liệu cũ lỗi JSON coi như chưa ghi đủ */ }
  const due = String(record.due_date || '').trim();
  const recorded = nceOwner(record).length > 0 && correction.length >= 5;
  if (!due || record.record_status === 'cancelled' || record.approval_status === 'approved' || !recorded || due >= today) return 0;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000);
  return Number.isFinite(days) && days > 0 ? days : 0;
}
