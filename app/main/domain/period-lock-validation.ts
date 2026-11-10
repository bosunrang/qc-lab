import { cleanText } from './text-utils';

const YM_RE = /^\d{4}-\d{2}$/;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function isValidYm(value: unknown): value is string {
  return YM_RE.test(String(value || ''));
}

export function ymOfDate(date: string): string {
  return String(date || '').slice(0, 7);
}

/** `acknowledge`: người khoá đã xem danh sách việc còn tồn của kỳ và vẫn khoá
 * (GV4 mục 3) — chỉ nhận đúng `true`. */
export interface LockPeriodInput { ym?: unknown; note?: unknown; acknowledge?: unknown }
export interface PreparedLockPeriod { ym: string; note: string; acknowledge: boolean }

/** `today` (YYYY-MM-DD theo giờ máy): kỳ chưa tới không có dữ liệu để xem xét,
 * khoá trước chỉ chặn việc nhập QC khi kỳ đó diễn ra — cùng mốc với cổng ký
 * biên bản tháng (`validateReviewSignature`). */
export function validateLockPeriod(input: LockPeriodInput, today: string): ValidationResult<PreparedLockPeriod> {
  const ym = cleanText(input.ym, 7).trim();
  if (!isValidYm(ym)) return { ok: false, code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM.' };
  if (ym > today.slice(0, 7)) return { ok: false, code: 'future-period', message: 'Không khoá kỳ chưa tới.' };
  const note = cleanText(input.note, 500).trim();
  return { ok: true, data: { ym, note, acknowledge: input.acknowledge === true } };
}

export interface UnlockPeriodInput { ym?: unknown; note?: unknown }
export interface PreparedUnlockPeriod { ym: string; note: string }

export function validateUnlockPeriod(input: UnlockPeriodInput): ValidationResult<PreparedUnlockPeriod> {
  const ym = cleanText(input.ym, 7).trim();
  if (!isValidYm(ym)) return { ok: false, code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM.' };
  const note = cleanText(input.note, 500).trim();
  if (note.length < 5) return { ok: false, code: 'missing-note', message: 'Nhập lý do mở khoá (ít nhất 5 ký tự).' };
  return { ok: true, data: { ym, note } };
}


