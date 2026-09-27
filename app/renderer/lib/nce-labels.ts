// Nhãn hiển thị cho các trạng thái của hồ sơ NCE. Cột CSDL lưu MÃ (trạng thái
// duyệt `pending`/`approved`/`returned`, hiệu quả `pending`/`effective`/`ineffective`);
// mọi nơi hiện cho người dùng (thẻ Khắc phục sự cố, phụ lục báo cáo PDF/Excel/CSV)
// đọc qua đây để không in mã máy ra văn bản chính thức.
import type { NceRecord } from '../../shared/qc-api';

type Tone = 'ok' | 'warn' | 'rej' | 'none';

export const NCE_APPROVAL_LABEL: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', returned: 'Trả lại' };
export const NCE_EFFECTIVENESS_LABEL: Record<string, string> = { pending: 'Chưa đánh giá', effective: 'Hiệu quả', ineffective: 'Không hiệu quả' };

/** Trạng thái duyệt kèm màu thẻ; hồ sơ đã hủy luôn hiện "Đã hủy". */
export function nceApprovalBadge(record: Pick<NceRecord, 'record_status' | 'approval_status'>): { label: string; tone: Tone } {
  if (record.record_status === 'cancelled') return { label: 'Đã hủy', tone: 'none' };
  const tone: Tone = record.approval_status === 'approved' ? 'ok' : record.approval_status === 'returned' ? 'rej' : 'warn';
  return { label: NCE_APPROVAL_LABEL[record.approval_status] || NCE_APPROVAL_LABEL.pending, tone };
}

export function nceEffectivenessBadge(record: Pick<NceRecord, 'effectiveness_status'>): { label: string; tone: Tone } {
  const tone: Tone = record.effectiveness_status === 'effective' ? 'ok' : record.effectiveness_status === 'ineffective' ? 'rej' : 'none';
  return { label: NCE_EFFECTIVENESS_LABEL[record.effectiveness_status] || NCE_EFFECTIVENESS_LABEL.pending, tone };
}
