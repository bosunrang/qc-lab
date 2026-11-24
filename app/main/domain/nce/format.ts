// Tiện ích nhỏ dùng chung cho các hàm NCE: so sánh/định danh lần chạy, kiểm
// ngày và dựng câu thông báo tiếng Việt. Không phụ thuộc gì ngoài domain.
import { compareQcRunKey, qcRunKey } from '../sort-order';
import { validLocalDate } from '../local-date';
import type { NceRunKey } from './types';

export function runKeyOf(run: NceRunKey): string { return qcRunKey({ date: run.date, runId: run.runId }); }

/** Âm khi `a` chạy trước `b` — cùng thứ tự với chuỗi điểm QC ở Westgard. */
export function compareRun(a: NceRunKey, b: NceRunKey): number { return compareQcRunKey(runKeyOf(a), runKeyOf(b)); }

export function sameRun(a: NceRunKey, b: NceRunKey): boolean { return compareRun(a, b) === 0; }

/** "12/10/2026 · lần 3" — dùng trong thông báo lỗi và tóm tắt hồ sơ. */
export function runLabel(run: NceRunKey): string {
  const [y, m, d] = run.date.split('-');
  const day = y && m && d ? `${d}/${m}/${y}` : run.date;
  return run.runId ? `${day} · lần ${run.runId}` : day;
}

/** Ngày `YYYY-MM-DD` có thật hoặc chuỗi rỗng. */
export function cleanDate(value: unknown): string { return validLocalDate(String(value ?? '').trim()); }

/** Phần ngày của một thời điểm ISO hoặc của chính ngày `YYYY-MM-DD`. Thời điểm
 * ISO được đổi về ngày địa phương, không cắt chuỗi UTC (lỗi R-06). */
export function localDateOf(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function textLength(value: string | null | undefined): number { return String(value ?? '').trim().length; }
