// Cấu hình NCE lưu ở `app_meta` (kế hoạch mục 3). Các giá trị mặc định là TẠM
// THỜI, chưa có chuẩn quy định con số: phòng xét nghiệm chốt theo SOP rồi sửa
// ở Cài đặt. Đọc qua `prepareNceConfig()` để giá trị hỏng rơi về mặc định.
import type { NceSeparationException } from './permissions';
import type { NceTier } from './types';

export interface NceConfig {
  dueDays: Readonly<Record<NceTier, number>>;
  recurrenceWindowDays: number;
  separationException: NceSeparationException;
}

export const NCE_DEFAULT_CONFIG: NceConfig = {
  dueDays: { low: 7, capa: 30 },
  recurrenceWindowDays: 90,
  separationException: { enabled: false, sopRef: '' },
};

function days(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : fallback;
}

export function prepareNceConfig(raw: unknown): NceConfig {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const due = input.dueDays && typeof input.dueDays === 'object' ? input.dueDays as Record<string, unknown> : {};
  const sep = input.separationException && typeof input.separationException === 'object' ? input.separationException as Record<string, unknown> : {};
  const sopRef = String(sep.sopRef ?? '').trim().slice(0, 120);
  return {
    dueDays: { low: days(due.low, NCE_DEFAULT_CONFIG.dueDays.low), capa: days(due.capa, NCE_DEFAULT_CONFIG.dueDays.capa) },
    recurrenceWindowDays: days(input.recurrenceWindowDays, NCE_DEFAULT_CONFIG.recurrenceWindowDays),
    // Bật ngoại lệ mà không có mã SOP thì coi như tắt.
    separationException: { enabled: sep.enabled === true && sopRef.length > 0, sopRef },
  };
}

/** Hạn mặc định khi lập hồ sơ: theo tầng nếu đã phân, chưa phân thì dùng hạn
 * của tầng `low` (ngắn hơn) để hồ sơ không bị bỏ quên. */
export function defaultNceDueDate(detectedDate: string, tier: NceTier | '', config: NceConfig = NCE_DEFAULT_CONFIG): string {
  const [y, m, d] = detectedDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const due = new Date(y, m - 1, d + config.dueDays[tier || 'low']);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`;
}
