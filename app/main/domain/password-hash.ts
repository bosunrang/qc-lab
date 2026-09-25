import { randomBytes, pbkdf2, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

export const PASSWORD_HASH_ITERATIONS = 600000; // OWASP minimum cho PBKDF2-SHA256
const KEY_LENGTH = 32;
const DIGEST = 'sha256';
const pbkdf2Async = promisify(pbkdf2);

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

/** Bản bất đồng bộ cho mọi handler tài khoản (tạo, đặt lại, đổi mật khẩu):
 * cùng lý do với `verifyPasswordAsync` bên dưới — 600.000 vòng chạy đồng bộ
 * làm đơ cả cửa sổ desktop lẫn máy chủ LAN. */
export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await pbkdf2Async(password, salt, PASSWORD_HASH_ITERATIONS, KEY_LENGTH, DIGEST)).toString('hex');
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

interface StoredHash { iterations: number; salt: string; expected: Buffer }

function parseStored(stored: string): StoredHash | null {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return null;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expectedHex) return null;
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length ? { iterations, salt, expected } : null;
  } catch {
    return null;
  }
}

/** So khớp bằng `timingSafeEqual` (không dùng `===` trên chuỗi) để tránh lộ
 * thời gian so sánh làm oracle cho tấn công dò từng byte hash. */
function matches(expected: Buffer, actual: Buffer): boolean {
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function verifyPassword(password: string, stored: string): boolean {
  const parsed = parseStored(stored);
  if (!parsed) return false;
  try {
    return matches(parsed.expected, pbkdf2Sync(password, parsed.salt, parsed.iterations, parsed.expected.length, DIGEST));
  } catch {
    return false;
  }
}

/** Bản bất đồng bộ cho đường đăng nhập: 600.000 vòng mất vài trăm ms, chạy
 * đồng bộ sẽ chặn main process — cửa sổ desktop đơ và máy chủ LAN ngừng phục
 * vụ mọi máy trạm trong lúc đó. `crypto.pbkdf2` chạy trên thread pool của
 * libuv nên event loop vẫn thông. */
export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  const parsed = parseStored(stored);
  if (!parsed) return false;
  try {
    return matches(parsed.expected, await pbkdf2Async(password, parsed.salt, parsed.iterations, parsed.expected.length, DIGEST));
  } catch {
    return false;
  }
}

export function isPbkdf2Hash(value: string): boolean {
  return /^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+$/.test(String(value || ''));
}
