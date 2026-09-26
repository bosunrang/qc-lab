// Hằng và hàm thuần dùng chung của trang Six Sigma. Tách khỏi `SigmaPage.tsx`
// ngày 2026-09-26 (kế hoạch kiến trúc D.7), giữ nguyên thứ tự khai báo.
import { vnDate as formatVnDate } from '../../lib/format';
import type { SigmaCohortView, SigmaLevelResult } from '../../../shared/qc-api';
import type { SigmaTeaSource } from '../../lib/sigma-tea';

/** Dải năm cho bộ lọc và hộp thêm kỳ: năm nay ± 5. */
export const PERIOD_YEARS = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);

/** Nguồn TEa được hỗ trợ. Cấu hình được chụp vào kỳ Sigma khi tạo để lịch sử
 * không bị thay đổi ngầm. */
export const TEA_SOURCES: ReadonlyArray<{ value: SigmaTeaSource; label: string }> = [
  { value: 'lab', label: 'TEa chuẩn hóa của phòng xét nghiệm' },
  { value: 'eflm', label: 'EFLM - nhập từ database' },
  { value: 'clia', label: 'CLIA PT (CMS-3355-F)' },
  { value: 'ricos', label: 'Ricos / Westgard biological variation' },
];

export function isKnownTeaSource(value: string): value is SigmaTeaSource {
  return TEA_SOURCES.some((source) => source.value === value);
}

/** DPMO dưới 10 giữ 2 chữ số; dưới 1000 làm tròn; các số lớn phân nhóm nghìn. */
export function formatDpmo(value: unknown): string {
  const dpmo = Number(value);
  if (!Number.isFinite(dpmo)) return '—';
  return dpmo < 10 ? dpmo.toFixed(2) : dpmo < 1000 ? dpmo.toFixed(0) : Math.round(dpmo).toLocaleString('en-US');
}

/** Định dạng kỳ ISO thành nhãn tiếng Việt, ví dụ `2026-09` → `Kỳ 09/2026`. */
export function vnPeriod(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period || '');
  return m ? `Kỳ ${m[2]}/${m[1]}` : (period || '?');
}

export const vnDate = (date: string) => formatVnDate(date, '—');
/** Chỉ rút gọn khi hiển thị trong control; giá trị lưu và tính Sigma vẫn giữ
 * nguyên độ chính xác. Dùng chung cả lúc khôi phục sau khi lưu lỗi để ô không
 * bất ngờ hiện lại một dãy thập phân dài. */
export function editablePercent(value: number | null | undefined): string { return value != null ? value.toFixed(2) : ''; }
/** Tháng hiện hành theo múi giờ máy. Không dùng `toISOString()` trực tiếp vì
 * rạng sáng ở Việt Nam có thể rơi về
 * tháng trước theo UTC. */
export function currentPeriod(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 7);
}
/** Sigma = (TEa − |Bias|) / CV cần ĐỦ BA đầu vào. Thiếu cái nào thì phải nói
 * đích danh cái đó: thông báo cũ ("Chưa nhập CV hoặc Bias được chọn" /
 * "Chưa đủ dữ liệu") không hề nhắc TEa, nên khi CV và Bias đã nhập đủ mà TEa
 * chưa có thì người dùng không có cách nào biết còn thiếu gì. */
export function missingSigmaInputs(level: SigmaLevelResult): string[] {
  const missing: string[] = [];
  if (level.tea == null) missing.push('TEa');
  if (level.cv == null) missing.push('CV IQC%');
  if (level.biasEqa == null) missing.push('Bias RMS EQA%');
  return missing;
}

export function cohortStatusLabel(status: SigmaCohortView['status'] | string): string {
  return status === 'eligible' ? 'Đủ số điểm — cần rà soát' : status === 'provisional' ? 'Tạm thời (20–29)' : status === 'insufficient' ? 'Chưa đủ (<20)'
    : status === 'out-of-control' ? 'Mất kiểm soát chưa xử lý' : 'Không ổn định';
}

/** Màu trạng thái dùng bộ badge chung, để bảng chọn cohort không tự tạo một
 * ngôn ngữ cảnh báo riêng với phần còn lại của ứng dụng. */
export function cohortStatusTone(status: SigmaCohortView['status'] | string): 'ok' | 'warn' | 'rej' {
  return status === 'eligible' ? 'ok' : status === 'provisional' || status === 'insufficient' ? 'warn' : 'rej';
}

/** N/R của thiết kế QC, kèm phương án tương đương mà Westgard nêu sẵn.
 * Westgard công bố HAI bảng khác nhau cho 2 mức và 3 mức QC, nên phải nói rõ
 * bảng nào đang áp — nếu không, một phòng chạy 3 mức sẽ đọc N/R của bảng 2
 * mức mà không biết. */
export function designRunText(design: { n: number; r: number; alternatives: { n: number; r: number; note?: string }[] }): string {
  const one = (n: number, r: number) => `N=${n}` + (r > 1 ? ` · R=${r}` : '');
  const alts = design.alternatives.map((alt) => one(alt.n, alt.r) + (alt.note ? ` (${alt.note})` : ''));
  return [one(design.n, design.r), ...alts].join(' hoặc ');
}

/** Năm bậc màu và ngưỡng diễn giải Sigma dùng thống nhất trong toàn thẻ. */
export function sigmaZone(value: number | null | undefined): { c: string; label: string } {
  const sigma = value == null ? NaN : Number(value);
  if (!Number.isFinite(sigma)) return { c: '#506674', label: '—' };
  if (sigma >= 6) return { c: '#13603f', label: 'Đẳng cấp thế giới' };
  if (sigma >= 5) return { c: '#2c7d5c', label: 'Xuất sắc' };
  if (sigma >= 4) return { c: '#3f9a55', label: 'Tốt' };
  if (sigma >= 3) return { c: '#dd8b1f', label: 'Cận biên' };
  return { c: '#c0362c', label: 'Không đạt' };
}
