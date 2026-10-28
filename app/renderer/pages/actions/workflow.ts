// Điều hướng giao diện theo bước do main trả về; không tự tính điều kiện
// cho chạy lại, nộp duyệt hay đóng hồ sơ.
import type { NceMissingItem, NceRecordRow } from '../../../shared/qc-api';

export type NceStage = 'identity' | 'check' | 'technical' | 'impact' | 'release' | 'capa' | 'review';

export const NCE_STAGES: readonly { id: NceStage; label: string; description: string }[] = [
  { id: 'identity', label: 'Ghi nhận sự cố', description: 'Thông tin sự cố' },
  { id: 'check', label: 'Kiểm tra nhanh', description: 'Vật liệu, máy & thao tác' },
  { id: 'technical', label: 'Xác minh kỹ thuật', description: 'Sai số, Bias & ngưỡng' },
  { id: 'impact', label: 'Ảnh hưởng bệnh nhân', description: 'Phạm vi & quyết định' },
  { id: 'release', label: 'Cho hoạt động trở lại', description: 'QC xác minh & thẩm quyền' },
  { id: 'capa', label: 'Điều tra & CAPA', description: 'Nguy cơ & hành động' },
  { id: 'review', label: 'Phê duyệt & lịch sử', description: 'Bằng chứng & duyệt' },
];

export const NEXT_STEP_TEXT: Readonly<Record<string, string>> = {
  release: 'Hoàn tất điều kiện cho hoạt động trở lại',
  submit: 'Hoàn thiện hồ sơ để nộp duyệt',
  approve: 'Rà soát bằng chứng và duyệt đóng hồ sơ',
};

export function stageForMissing(item: NceMissingItem): NceStage {
  if (['hold', 'hold-iqc', 'containment', 'occurred', 'owner', 'due-date'].includes(item.code)) return 'identity';
  if (item.code.startsWith('check-')) return 'check';
  if (item.code.startsWith('technical-')) return 'technical';
  if (item.code.startsWith('patient-impact')) return 'impact';
  if (item.code.includes('rerun') || ['release', 'no-trigger'].includes(item.code)) return 'release';
  return 'capa';
}

export function nextStage(record: NceRecordRow, missing: readonly NceMissingItem[]): NceStage {
  if (record.next_step === 'approve' || !record.next_step) return 'review';
  if (missing.length) return stageForMissing(missing[0]);
  return record.next_step === 'release' ? 'release' : 'review';
}

/** Tìm theo tiếng Việt không dấu, mã hồ sơ và người phụ trách. */
export function nceSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[đĐ]/g, 'd').toLocaleLowerCase('vi').trim();
}
