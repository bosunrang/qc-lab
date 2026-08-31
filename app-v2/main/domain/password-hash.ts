// Băm/kiểm mật khẩu — PBKDF2-SHA256, cùng định dạng chuỗi lưu trữ với bản cũ
// (src/domain/auth/pbkdf2-password-service.ts: `pbkdf2$<iterations>$<salt>$<hash>`)
// để giữ tính liên tục nếu sau này cần import user từ backup cũ, nhưng dùng
// `node:crypto` thật thay vì phải chạy được trong trình duyệt — app mới chỉ
// chạy trong main process nên không có ràng buộc đó.
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';

export const PASSWORD_HASH_ITERATIONS = 600000; // OWASP minimum cho PBKDF2-SHA256
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

/** So khớp bằng `timingSafeEqual` (không dùng `===` trên chuỗi) để tránh lộ
 * thời gian so sánh làm oracle cho tấn công dò từng byte hash. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expectedHex) return false;
  let expected: Buffer, actual: Buffer;
  try {
    expected = Buffer.from(expectedHex, 'hex');
    actual = pbkdf2Sync(password, salt, iterations, expected.length, DIGEST);
  } catch {
    return false;
  }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function isPbkdf2Hash(value: string): boolean {
  return /^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+$/.test(String(value || ''));
}
