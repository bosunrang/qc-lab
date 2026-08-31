// Hàm làm sạch chuỗi/id dùng chung — tham khảo qc-core.ts cũ (cleanText/
// cleanId/ID_RE), viết lại gọn cho app mới.
const TEXT_LIMIT = 500;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const CONTROL_OR_ANGLE_RE = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F<>]');
const CONTROL_RE = new RegExp('[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', 'g');
const COMBINING_MARKS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

export function cleanText(value: unknown, max = TEXT_LIMIT): string {
  if (value == null || value === '') return '';
  const text = String(value);
  if (text.length <= max && !CONTROL_OR_ANGLE_RE.test(text)) return text;
  return text
    .replace(CONTROL_RE, '')
    .replace(/\r\n?/g, '\n')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .slice(0, max);
}

export function cleanId(value: unknown): string {
  const id = cleanText(value, 80).trim();
  return ID_RE.test(id) ? id : '';
}

export function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Chuẩn hoá để so sánh không phân biệt dấu/hoa-thường (tên máy/xét nghiệm
 * trùng nhau dù gõ khác dấu vẫn phải bị coi là trùng). */
export function textKey(value: unknown): string {
  return String(value || '').normalize('NFD').replace(COMBINING_MARKS_RE, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function sameText(first: unknown, second: unknown): boolean {
  return textKey(first) === textKey(second);
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
