// Che dữ liệu nhạy cảm trước khi ghi log ra tệp (kế hoạch kiến trúc G.2).
// Log nằm trên đĩa máy chính và được người dùng gửi đi khi báo lỗi, nên không
// được chứa mật khẩu, token LIS/Firebase hay khoá API. Hàm thuần, không phụ
// thuộc Node, để test và bản xem trước dùng chung.

const MASK = '[đã che]';

/** Tên trường mang bí mật: mật khẩu, token, khoá, cookie phiên. */
const SECRET_KEY = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|credential|private[-_]?key/i;

/** Mẫu bí mật trong chuỗi tự do: `password=...`, `"token":"..."`, `Bearer ...`,
 * JWT (ba đoạn base64url ngăn bằng dấu chấm) và khoá API của Google/Firebase. */
// `Bearer` chạy trước mẫu theo tên trường: `Authorization: Bearer abc` mà che
// theo tên trường trước thì chỉ che chữ "Bearer", còn nguyên token phía sau.
const TEXT_PATTERNS: [RegExp, string][] = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/g, `Bearer ${MASK}`],
  [/("?(?:pass(?:word)?|secret|token|api[-_]?key|id[-_]?token|refresh[-_]?token|authorization)"?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&}]+)/gi, `$1${MASK}`],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, MASK],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, MASK],
];

export function redactText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of TEXT_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/** Che đệ quy: giá trị của trường có tên nhạy cảm bị thay hẳn, chuỗi còn lại
 * qua `redactText()`. Giới hạn độ sâu để một đối tượng vòng không treo log. */
export function redactValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value == null || typeof value !== 'object') return value;
  if (depth > 5) return '[lược bớt]';
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY.test(key) ? MASK : redactValue(item, depth + 1);
  }
  return out;
}
