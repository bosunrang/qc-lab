import { sha256Bytes } from './sha256-browser';

/** Thấp hơn bản main process (600.000) một cách CÓ CHỦ ĐÍCH — xem đầu file.
 * Đây là số vòng dùng khi TẠO hash mới ở chế độ xem trước; lúc KIỂM thì số
 * vòng luôn lấy từ chuỗi đã lưu. */
export const PASSWORD_HASH_ITERATIONS = 20000;
const KEY_LENGTH = 32;
const BLOCK_SIZE = 64; // SHA-256 block = 64 byte

function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  // RFC 2104: khoá dài hơn block thì băm trước; ngắn hơn thì đệm 0.
  let k = key;
  if (k.length > BLOCK_SIZE) k = sha256Bytes(k);
  const padded = new Uint8Array(BLOCK_SIZE);
  padded.set(k);

  const inner = new Uint8Array(BLOCK_SIZE + message.length);
  const outer = new Uint8Array(BLOCK_SIZE + 32);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    inner[i] = padded[i] ^ 0x36;
    outer[i] = padded[i] ^ 0x5c;
  }
  inner.set(message, BLOCK_SIZE);
  outer.set(sha256Bytes(inner), BLOCK_SIZE);
  return sha256Bytes(outer);
}

/** RFC 8018 §5.2. `keyLength` ≤ 32 nên chỉ cần đúng một block T_1. */
function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, keyLength: number): Uint8Array {
  const out = new Uint8Array(keyLength);
  let written = 0;
  for (let block = 1; written < keyLength; block++) {
    const seed = new Uint8Array(salt.length + 4);
    seed.set(salt);
    seed[salt.length] = (block >>> 24) & 0xff;
    seed[salt.length + 1] = (block >>> 16) & 0xff;
    seed[salt.length + 2] = (block >>> 8) & 0xff;
    seed[salt.length + 3] = block & 0xff;

    let u = hmacSha256(password, seed);
    const acc = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = hmacSha256(password, u);
      for (let j = 0; j < acc.length; j++) acc[j] ^= u[j];
    }
    const take = Math.min(acc.length, keyLength - written);
    out.set(acc.subarray(0, take), written);
    written += take;
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

const utf8 = new TextEncoder();

export function hashPassword(password: string): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = toHex(saltBytes);
  const hash = toHex(pbkdf2Sha256(utf8.encode(password), utf8.encode(salt), PASSWORD_HASH_ITERATIONS, KEY_LENGTH));
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

/** So khớp theo thời gian hằng định (tích luỹ XOR, không thoát sớm) — cùng
 * mục đích với `timingSafeEqual` của Node, thứ trình duyệt không có. */
function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(iterations) || iterations <= 0 || !salt || !expectedHex) return false;
  if (!/^[0-9a-f]+$/.test(expectedHex) || expectedHex.length % 2 !== 0) return false;
  const expected = fromHex(expectedHex);
  // Số vòng lấy TỪ CHUỖI (không phải hằng số của file này) — nhờ vậy hash tạo
  // ở bản Electron 600.000 vòng vẫn kiểm được ở đây, chỉ chậm hơn.
  const actual = pbkdf2Sha256(utf8.encode(password), utf8.encode(salt), iterations, expected.length);
  return timingSafeEqualBytes(expected, actual);
}

/** Cùng chữ ký với bản main process (vite alias thay module này vào chỗ
 * `password-hash`). Trình duyệt không có thread pool cho PBKDF2 nên vẫn tính
 * đồng bộ bên trong; chỉ bọc Promise để `auth.login()` dùng chung một đường. */
export async function verifyPasswordAsync(password: string, stored: string): Promise<boolean> {
  return verifyPassword(password, stored);
}

/** Như `verifyPasswordAsync`: tính đồng bộ bên trong, chỉ bọc Promise để các
 * handler tài khoản dùng chung một đường với bản main process. */
export async function hashPasswordAsync(password: string): Promise<string> {
  return hashPassword(password);
}

export function isPbkdf2Hash(value: string): boolean {
  return /^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+$/.test(String(value || ''));
}


