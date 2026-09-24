import { cleanText } from './text-utils';

const YM_RE = /^\d{4}-\d{2}$/;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export function isValidYm(value: unknown): value is string {
  return YM_RE.test(String(value || ''));
}

export function ymOfDate(date: string): string {
  return String(date || '').slice(0, 7);
}

export interface LockPeriodInput { ym?: unknown; note?: unknown }
export interface PreparedLockPeriod { ym: string; note: string }

export function validateLockPeriod(input: LockPeriodInput): ValidationResult<PreparedLockPeriod> {
  const ym = cleanText(input.ym, 7).trim();
  if (!isValidYm(ym)) return { ok: false, code: 'invalid-period', message: 'Kỳ phải có định dạng YYYY-MM.' };
  const note = cleanText(input.note, 500).trim();
  return { ok: true, data: { ym, note } };
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


