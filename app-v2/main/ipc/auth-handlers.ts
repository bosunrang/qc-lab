// IPC handler cho module Users/Auth. Đây là module mà mọi handler khác
// (config/entry/westgard/sigma/nce/reagent) đang chờ để thay TEMP_ACTOR
// (main/index.ts) bằng actor đăng nhập thật — xem ghi chú "Danh tính tạm
// thời" ở đó. Không có session token/cookie: app chạy 1 cửa sổ Electron duy
// nhất, main process tự giữ actor đang đăng nhập trong bộ nhớ (index.ts),
// module này chỉ lo xác thực + CRUD tài khoản.
import type { Db } from '../db/open-database';
import { uid } from '../domain/text-utils';
import { hashPassword, verifyPassword } from '../domain/password-hash';
import {
  validateUserCreate, validateUserUpdate, validateNewPassword, validateLoginInput,
  type UserCreateInput, type UserUpdateInput, type LoginInput,
} from '../domain/auth-validation';
import { type Actor, type IpcResult, writeAudit } from './shared';

interface UserRow {
  id: string; username: string; name: string; initials: string; external_code: string;
  role: string; page_perms_json: string | null; pass_hash: string; active: number;
  must_change_password: number;
}

export interface PublicUser {
  id: string; username: string; name: string; role: string; active: boolean; mustChangePassword: boolean;
}

function toPublicUser(row: UserRow): PublicUser {
  return { id: row.id, username: row.username, name: row.name, role: row.role, active: !!row.active, mustChangePassword: !!row.must_change_password };
}

function forbidden(message = 'Chỉ quản trị viên mới được thực hiện thao tác này.'): IpcResult<never> {
  return { ok: false, error: { code: 'forbidden', message } };
}

export function createAuthHandlers(db: Db) {
  function hasAnyUsers(): boolean {
    return (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c > 0;
  }

  function listUsers(actor: Actor): IpcResult<PublicUser[]> {
    if (actor.role !== 'admin') return forbidden();
    const rows = db.prepare('SELECT * FROM users ORDER BY username').all() as unknown as UserRow[];
    return { ok: true, data: rows.map(toPublicUser) };
  }

  /** Chỉ dùng đúng 1 lần khi bảng `users` còn rỗng — tạo tài khoản quản trị
   * đầu tiên mà KHÔNG cần actor có sẵn (chưa ai đăng nhập được vì chưa có
   * user nào). Actor ghi audit chính là tài khoản vừa tạo. */
  function bootstrapAdmin(input: { data: UserCreateInput }): IpcResult<PublicUser> {
    if (hasAnyUsers()) return { ok: false, error: { code: 'already-bootstrapped', message: 'Hệ thống đã có tài khoản, không thể khởi tạo lại.' } };
    const result = validateUserCreate(input.data, []);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { username, name, password } = result.data;
    const id = uid();
    db.prepare('INSERT INTO users(id,username,name,role,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,1,0)')
      .run(id, username, name, 'admin', hashPassword(password));
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as UserRow;
    writeAudit(db, { userId: id, username, name, role: 'admin', clientId: 'bootstrap' }, 'Khởi tạo tài khoản quản trị', `Tạo tài khoản quản trị đầu tiên "${username}"`, username);
    return { ok: true, data: toPublicUser(row) };
  }

  function login(input: { data: LoginInput }): IpcResult<PublicUser> {
    const result = validateLoginInput(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { username, password } = result.data;
    const row = db.prepare('SELECT * FROM users WHERE username=?').get(username) as UserRow | undefined;
    if (!row || !verifyPassword(password, row.pass_hash)) {
      return { ok: false, error: { code: 'invalid-credentials', message: 'Sai tên đăng nhập hoặc mật khẩu.' } };
    }
    if (!row.active) return { ok: false, error: { code: 'inactive', message: 'Tài khoản đã bị khoá.' } };
    writeAudit(db, { userId: row.id, username: row.username, name: row.name, role: row.role, clientId: 'app-v2-desktop' }, 'Đăng nhập', `Đăng nhập thành công`, row.username);
    return { ok: true, data: toPublicUser(row) };
  }

  function createUser(input: { data: UserCreateInput }, actor: Actor): IpcResult<PublicUser> {
    if (actor.role !== 'admin') return forbidden();
    const existingUsernames = (db.prepare('SELECT username FROM users').all() as { username: string }[]).map(r => r.username);
    const result = validateUserCreate(input.data, existingUsernames);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { username, name, role, password } = result.data;
    const id = uid();
    db.prepare('INSERT INTO users(id,username,name,role,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,1,1)')
      .run(id, username, name, role, hashPassword(password));
    writeAudit(db, actor, 'Thêm người dùng', `Tạo tài khoản "${username}" (${role})`, username);
    return { ok: true, data: toPublicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as UserRow) };
  }

  /** Chặn tự khoá/tự hạ quyền chính mình khỏi admin nếu đó là admin ACTIVE
   * cuối cùng — tránh khoá cứng, không còn ai vào sửa lại được (không có
   * đường "quên mật khẩu" nào khác trong app 1-cửa-sổ này). */
  function wouldRemoveLastActiveAdmin(db_: Db, targetId: string, nextRole: string, nextActive: boolean): boolean {
    if (nextRole === 'admin' && nextActive) return false;
    const target = db_.prepare('SELECT role, active FROM users WHERE id=?').get(targetId) as { role: string; active: number } | undefined;
    if (!target || target.role !== 'admin' || !target.active) return false;
    const otherActiveAdmins = (db_.prepare("SELECT COUNT(*) as c FROM users WHERE role='admin' AND active=1 AND id != ?").get(targetId) as { c: number }).c;
    return otherActiveAdmins === 0;
  }

  function updateUser(input: { id: unknown; data: UserUpdateInput }, actor: Actor): IpcResult<PublicUser> {
    if (actor.role !== 'admin') return forbidden();
    const id = String(input.id || '');
    const existing = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy người dùng.' } };
    const result = validateUserUpdate(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { name, role, active } = result.data;
    if (wouldRemoveLastActiveAdmin(db, id, role, active)) {
      return { ok: false, error: { code: 'last-admin', message: 'Phải còn ít nhất 1 quản trị viên đang hoạt động.' } };
    }
    db.prepare('UPDATE users SET name=?, role=?, active=? WHERE id=?').run(name, role, active ? 1 : 0, id);
    writeAudit(db, actor, 'Sửa người dùng', `Cập nhật "${existing.username}": ${role}, ${active ? 'hoạt động' : 'đã khoá'}`, existing.username);
    return { ok: true, data: toPublicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as UserRow) };
  }

  /** Admin đặt lại mật khẩu cho người khác — luôn bật must_change_password
   * để buộc đổi lại ở lần đăng nhập kế tiếp, không âm thầm giữ mật khẩu admin
   * vừa gõ làm mật khẩu lâu dài của người dùng. */
  function resetPassword(input: { id: unknown; data: { newPassword?: unknown } }, actor: Actor): IpcResult<{ id: string }> {
    if (actor.role !== 'admin') return forbidden();
    const id = String(input.id || '');
    const existing = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy người dùng.' } };
    const result = validateNewPassword(input.data?.newPassword);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    db.prepare('UPDATE users SET pass_hash=?, must_change_password=1 WHERE id=?').run(hashPassword(result.data), id);
    writeAudit(db, actor, 'Đặt lại mật khẩu', `Đặt lại mật khẩu cho "${existing.username}"`, existing.username);
    return { ok: true, data: { id } };
  }

  function changeOwnPassword(input: { data: { oldPassword?: unknown; newPassword?: unknown } }, actor: Actor): IpcResult<{ id: string }> {
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(actor.userId) as UserRow | undefined;
    if (!row) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy tài khoản.' } };
    if (!verifyPassword(String(input.data?.oldPassword || ''), row.pass_hash)) {
      return { ok: false, error: { code: 'wrong-password', message: 'Mật khẩu hiện tại không đúng.' } };
    }
    const result = validateNewPassword(input.data?.newPassword);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    db.prepare('UPDATE users SET pass_hash=?, must_change_password=0 WHERE id=?').run(hashPassword(result.data), row.id);
    writeAudit(db, actor, 'Đổi mật khẩu', `Tự đổi mật khẩu`, row.username);
    return { ok: true, data: { id: row.id } };
  }

  return { hasAnyUsers, listUsers, bootstrapAdmin, login, createUser, updateUser, resetPassword, changeOwnPassword };
}

export type AuthHandlers = ReturnType<typeof createAuthHandlers>;
