// Bảng TRANG × VAI TRÒ + quyền theo từng trang (`pagePerms`) — nguồn sự thật
// DUY NHẤT cho CẢ HAI tiến trình. Đặt ở `main/domain/` (không phải renderer)
// vì main mới là nơi chặn thật: `auth-handlers.ts` phải thu hẹp `pagePerms`
// theo vai trò trước khi ghi DB, không tin danh sách renderer gửi lên.
// `renderer/lib/permissions.ts` chỉ re-export lại file này — cùng cách
// `renderer/browser-mock/api.ts` tái dùng `main/domain/*` (xem CLAUDE.md).
//
// File này KHÔNG import gì để test được thẳng trên `.ts` qua ESM
// (app/tests/page-roles.test.mjs) — thêm import vào đây sẽ phá bài test đó.
//
// Đối chiếu hệ thống: `ROUTER_PAGE_DEFS` + `rolePageIds`/`userPageIds`/

export type Role = 'admin' | 'technician' | 'viewer';

/** Thứ tự hiện trong mọi ô chọn vai trò — khớp `ROUTER_ROLE_LIST` hệ thống. */
export const ROLE_LIST: readonly Role[] = ['admin', 'technician', 'viewer'];

export interface PageDef {
  /** Khớp id trang của hệ thống (`dash`, `entry`...) — cũng là id icon sidebar
   * và là giá trị lưu trong `users.page_perms_json`. */
  id: string;
  /** Route của app (HashRouter) — hệ thống không có path nên field này là mới. */
  path: string;
  label: string;
  roles: readonly Role[];
}

const ALL: readonly Role[] = ['admin', 'technician', 'viewer'];
const STAFF: readonly Role[] = ['admin', 'technician'];
const ADMIN_ONLY: readonly Role[] = ['admin'];


export const PAGE_DEFS: readonly PageDef[] = [
  { id: 'dash', path: '/dashboard', label: 'Tổng quan', roles: ALL },
  { id: 'entry', path: '/entry', label: 'Nhập QC & Biểu đồ', roles: ALL },
  { id: 'westgard', path: '/westgard', label: 'Phân tích Westgard', roles: ALL },
  { id: 'sigma', path: '/sigma', label: 'Six Sigma & Sai số', roles: ALL },
  { id: 'reagent', path: '/reagent', label: 'So sánh hóa chất', roles: ALL },
  { id: 'actions', path: '/actions', label: 'Khắc phục sự cố', roles: STAFF },
  { id: 'report', path: '/report', label: 'Báo cáo & Biểu mẫu', roles: ALL },
  { id: 'manage', path: '/manage', label: 'Cấu hình chung', roles: ADMIN_ONLY },
  { id: 'users', path: '/users', label: 'Người dùng', roles: ADMIN_ONLY },
  { id: 'audit', path: '/audit', label: 'Nhật ký hoạt động', roles: ADMIN_ONLY },
  { id: 'settings', path: '/settings', label: 'Cài đặt & Đám mây', roles: ADMIN_ONLY },
];

/** Vai trò khi chưa biết gì (chưa nạp xong phiên, dữ liệu hỏng, vai trò lạ)
 * là vai trò HẸP NHẤT — khớp `role()` hệ thống trả 'viewer' khi `currentUser`
 * rỗng. Không mặc định mở. */
export function roleOf(role: string | null | undefined): Role {
  return role === 'admin' || role === 'technician' ? role : 'viewer';
}

/** admin + KTV. Khớp `canWrite()` hệ thống. */
export function canWriteRole(role: string | null | undefined): boolean {
  const r = roleOf(role);
  return r === 'admin' || r === 'technician';
}

export function isAdminRole(role: string | null | undefined): boolean {
  return roleOf(role) === 'admin';
}

export function pageById(id: string): PageDef | undefined {
  return PAGE_DEFS.find((page) => page.id === id);
}

/** Tập trang MỘT VAI TRÒ được phép — trần trên, `pagePerms` chỉ thu hẹp
 * thêm, không bao giờ mở rộng vượt qua đây. */
export function rolePageIds(role: string | null | undefined): string[] {
  const r = roleOf(role);
  return PAGE_DEFS.filter((page) => page.roles.includes(r)).map((page) => page.id);
}


export function selectUserPermissions(selectedIds: unknown, allowedIds: unknown): string[] {
  const allowed = new Set(Array.isArray(allowedIds) ? allowedIds.map((value) => String(value)) : []);
  const selected = Array.isArray(selectedIds) ? selectedIds : [];
  return [...new Set(selected.map((value) => String(value)).filter((id) => allowed.has(id)))];
}


export function userPageIds(user: { role?: string | null; pagePerms?: unknown } | null | undefined): string[] {
  if (!user) return rolePageIds('viewer');
  const base = rolePageIds(user.role);
  if (!Array.isArray(user.pagePerms)) return base;
  const picked = selectUserPermissions(user.pagePerms, base);
  return picked.length ? picked : base.slice(0, 1);
}

/** Vai trò có được xem trang này không — CHƯA xét `pagePerms` của tài khoản.
 * Dùng cho lưới "Thẻ được phép dùng" (ô nào bật/tắt được). */
export function canAccessPage(id: string, role: string | null | undefined): boolean {
  const page = pageById(id);
  return !!page && page.roles.includes(roleOf(role));
}

/** Tài khoản này có mở được trang đó không — CÓ xét `pagePerms`. Đây là hàm
 * mà sidebar và route guard dùng. */
export function canUserAccessPage(id: string, user: { role?: string | null; pagePerms?: unknown } | null | undefined): boolean {
  return !!pageById(id) && userPageIds(user).includes(id);
}


export function firstAccessPath(user: { role?: string | null; pagePerms?: unknown } | null | undefined): string {
  const allowed = new Set(userPageIds(user));
  const page = PAGE_DEFS.find((def) => allowed.has(def.id));
  return page ? page.path : '/dashboard';
}

export function roleLabel(role: string | null | undefined): string {
  const r = roleOf(role);
  return r === 'admin' ? 'Quản trị' : r === 'technician' ? 'KTV' : 'Chỉ xem';
}


