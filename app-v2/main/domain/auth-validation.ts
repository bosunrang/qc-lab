// Validate cho module Users/Auth. Tham khảo vai trò từ bản cũ
// (admin/technician/viewer, xem CLAUDE.md "roleSelectOptions") nhưng bỏ
// pagePerms tuỳ biến theo trang — phạm vi module này chỉ có 3 vai trò cố
// định, chưa có phân quyền theo từng trang riêng lẻ.
import { cleanText, sameText } from './text-utils';

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export const ROLES = ['admin', 'technician', 'viewer'] as const;
export type Role = typeof ROLES[number];

const USERNAME_RE = /^[A-Za-z0-9._-]{3,40}$/;
const MIN_PASSWORD_LENGTH = 8;

function cleanRole(value: unknown): Role {
  return (ROLES as readonly string[]).includes(value as string) ? (value as Role) : 'technician';
}

export interface UserCreateInput { username?: unknown; name?: unknown; role?: unknown; password?: unknown }
export interface PreparedUserCreate { username: string; name: string; role: Role; password: string }

/** `existingUsernames` = username các tài khoản đã có — caller (IPC handler)
 * tự SELECT từ SQLite rồi truyền vào, giữ hàm này thuần, dễ test không cần DB. */
export function validateUserCreate(input: UserCreateInput, existingUsernames: readonly string[]): ValidationResult<PreparedUserCreate> {
  const username = cleanText(input.username, 60).trim();
  const name = cleanText(input.name, 200).trim();
  const role = cleanRole(input.role);
  const password = String(input.password || '');
  if (!username) return { ok: false, code: 'missing-username', message: 'Nhập tên đăng nhập.' };
  if (!USERNAME_RE.test(username)) {
    return { ok: false, code: 'invalid-username', message: 'Tên đăng nhập chỉ gồm chữ, số, ".", "_", "-" (3-40 ký tự).' };
  }
  if (existingUsernames.some(u => sameText(u, username))) {
    return { ok: false, code: 'duplicate-username', message: 'Tên đăng nhập này đã tồn tại.' };
  }
  if (!name) return { ok: false, code: 'missing-name', message: 'Nhập họ tên.' };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: 'weak-password', message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }
  return { ok: true, data: { username, name, role, password } };
}

export interface UserUpdateInput { name?: unknown; role?: unknown; active?: unknown }
export interface PreparedUserUpdate { name: string; role: Role; active: boolean }

export function validateUserUpdate(input: UserUpdateInput): ValidationResult<PreparedUserUpdate> {
  const name = cleanText(input.name, 200).trim();
  if (!name) return { ok: false, code: 'missing-name', message: 'Nhập họ tên.' };
  return { ok: true, data: { name, role: cleanRole(input.role), active: input.active !== false } };
}

export function validateNewPassword(value: unknown): ValidationResult<string> {
  const password = String(value || '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: 'weak-password', message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }
  return { ok: true, data: password };
}

export interface LoginInput { username?: unknown; password?: unknown }
export interface PreparedLogin { username: string; password: string }

export function validateLoginInput(input: LoginInput): ValidationResult<PreparedLogin> {
  const username = cleanText(input.username, 60).trim();
  const password = String(input.password || '');
  if (!username || !password) return { ok: false, code: 'missing-credentials', message: 'Nhập tên đăng nhập và mật khẩu.' };
  return { ok: true, data: { username, password } };
}
