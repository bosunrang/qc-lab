// Validate cho module Users/Auth. 3 vai trò cố định admin/technician/viewer
// (khớp app cũ) CỘNG `pagePerms` — quyền theo từng trang, thêm ở Giai đoạn
// D3.1 (trước đó cố ý chưa làm, xem docs/APP-V2-PLAN.md mục A2).
//
// `pagePerms` LUÔN được thu hẹp theo vai trò ngay tại đây
// (`selectUserPermissions` + `rolePageIds`), không tin danh sách renderer
// gửi lên: một request tự dựng có thể kèm id trang mà vai trò đó không được
// xem, và bảng `users` là nơi route guard đọc lại để quyết định cho vào.
import { cleanText, sameText } from './text-utils';
import { rolePageIds, selectUserPermissions } from './page-roles';

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

export const ROLES = ['admin', 'technician', 'viewer'] as const;
export type Role = typeof ROLES[number];

const USERNAME_RE = /^[A-Za-z0-9._-]{3,40}$/;
const MIN_PASSWORD_LENGTH = 8;

function cleanRole(value: unknown): Role {
  return (ROLES as readonly string[]).includes(value as string) ? (value as Role) : 'technician';
}

export interface UserCreateInput { username?: unknown; name?: unknown; initials?: unknown; role?: unknown; password?: unknown; pagePerms?: unknown }
export interface PreparedUserCreate { username: string; name: string; initials: string; role: Role; password: string; pagePerms: string[] }

/** Mã viết tắt nhân viên: `cleanText(...,12).trim().toUpperCase()` — copy
 * đúng `addUser()` app cũ (hiện sau @username trong bảng, và dùng làm mã
 * nhân viên trên báo cáo sau này). */
function cleanInitials(value: unknown): string {
  return cleanText(value, 12).trim().toUpperCase();
}

/** Thu hẹp danh sách thẻ theo vai trò; KHÔNG gửi gì lên = mặc định toàn bộ
 * thẻ của vai trò đó (khớp `collectUserPerms()` app cũ khi không tìm thấy
 * hộp checkbox). Chọn rỗng thì báo lỗi đúng câu chữ app cũ. */
function preparePagePerms(value: unknown, role: Role): ValidationResult<string[]> {
  if (value == null) return { ok: true, data: rolePageIds(role) };
  const picked = selectUserPermissions(value, rolePageIds(role));
  if (!picked.length) return { ok: false, code: 'missing-page-perms', message: 'Cần chọn ít nhất một thẻ được phép dùng.' };
  return { ok: true, data: picked };
}

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
  const perms = preparePagePerms(input.pagePerms, role);
  if (!perms.ok) return perms;
  return { ok: true, data: { username, name, initials: cleanInitials(input.initials), role, password, pagePerms: perms.data } };
}

export interface UserUpdateInput { name?: unknown; role?: unknown; active?: unknown; initials?: unknown; pagePerms?: unknown }
/** `initials`/`pagePerms` là `undefined` khi request KHÔNG gửi field đó —
 * nghĩa là GIỮ NGUYÊN giá trị đang có, không phải xoá (cùng quy ước với
 * logo ở settings-validation.ts). Nút Khoá/Mở khoá chỉ gửi active nên không
 * được vô tình xoá quyền theo trang của tài khoản. */
export interface PreparedUserUpdate { name: string; role: Role; active: boolean; initials?: string; pagePerms?: string[] }

export function validateUserUpdate(input: UserUpdateInput): ValidationResult<PreparedUserUpdate> {
  const name = cleanText(input.name, 200).trim();
  if (!name) return { ok: false, code: 'missing-name', message: 'Nhập họ tên.' };
  const role = cleanRole(input.role);
  const data: PreparedUserUpdate = { name, role, active: input.active !== false };
  if (input.initials !== undefined) data.initials = cleanInitials(input.initials);
  if (input.pagePerms !== undefined) {
    const perms = preparePagePerms(input.pagePerms, role);
    if (!perms.ok) return perms;
    data.pagePerms = perms.data;
  }
  return { ok: true, data };
}

export function validateNewPassword(value: unknown): ValidationResult<string> {
  const password = String(value || '');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, code: 'weak-password', message: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }
  return { ok: true, data: password };
}

// Ảnh đại diện luôn là canvas 160×160 do renderer tự resize trước khi gửi
// (`AvatarModal.tsx`, cùng cỡ `avatar-modal-controller.ts` app cũ) nên PNG
// data URL không bao giờ tới gần mốc này thật — chỉ là chặn an toàn với một
// request tự dựng gửi thẳng lên IPC, không phải giới hạn nghiệp vụ.
const AVATAR_MAX_LENGTH = 500_000;

export function validateSetAvatar(value: unknown): ValidationResult<string> {
  const dataUrl = String(value || '');
  if (!/^data:image\//.test(dataUrl)) return { ok: false, code: 'invalid-image', message: 'Ảnh không hợp lệ.' };
  if (dataUrl.length > AVATAR_MAX_LENGTH) return { ok: false, code: 'image-too-large', message: 'Ảnh quá lớn.' };
  return { ok: true, data: dataUrl };
}

export interface LoginInput { username?: unknown; password?: unknown }
export interface PreparedLogin { username: string; password: string }

export function validateLoginInput(input: LoginInput): ValidationResult<PreparedLogin> {
  const username = cleanText(input.username, 60).trim();
  const password = String(input.password || '');
  if (!username || !password) return { ok: false, code: 'missing-credentials', message: 'Nhập tên đăng nhập và mật khẩu.' };
  return { ok: true, data: { username, password } };
}
