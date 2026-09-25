// IPC handler cho module Users/Auth. Đây là module mà mọi handler khác
// (config/entry/westgard/sigma/nce/reagent) đang chờ để thay TEMP_ACTOR
// (main/index.ts) bằng actor đăng nhập thật — xem ghi chú "Danh tính tạm
// thời" ở đó. Không có session token/cookie: app chạy 1 cửa sổ Electron duy
// nhất, main process tự giữ actor đang đăng nhập trong bộ nhớ (index.ts),
// module này chỉ lo xác thực + CRUD tài khoản.
import type { Db } from '../db/sqlite-like';
import { uid } from '../domain/text-utils';
import { hashPasswordAsync, verifyPasswordAsync } from '../domain/password-hash';
import {
  validateUserCreate, validateUserUpdate, validateNewPassword, validateLoginInput, validateSetAvatar,
  type UserCreateInput, type UserUpdateInput, type LoginInput,
} from '../domain/auth-validation';
import { roleLabel, roleOf } from '../domain/page-roles';
import { type Actor, type IpcResult, writeAudit, notifyChanged, withTransaction } from './shared';

interface UserRow {
  id: string; username: string; name: string; initials: string; external_code: string;
  role: string; page_perms_json: string | null; pass_hash: string; active: number;
  must_change_password: number; avatar: string;
}

// `PublicUser` (và các kiểu dữ liệu dùng chung khác) có NGUỒN DUY NHẤT là
// `shared/qc-api.d.ts` — hợp đồng IPC giữa 2 tiến trình. Trước 2026-09-10
// file này tự khai một `PublicUser` riêng với `role: string`, trong khi hợp
// đồng khai `role: 'admin'|'technician'|'viewer'`: hai khai báo song song
// cùng tên, âm thầm lệch nhau. Không gate nào thấy vì `ipcRenderer.invoke()`
// trả `Promise<any>`. Import type từ `.d.ts` KHÔNG emit gì nên `rootDir` của
// tsconfig.app-main.json không bị ảnh hưởng (đã kiểm chứng: file build ra
// vẫn ở đúng `app-dist/main/ipc/`).
import type { PublicUser } from '../../shared/qc-api';

export type { PublicUser };

function parsePagePerms(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch { return null; }
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id, username: row.username, name: row.name, initials: row.initials || '',
    // `users.role` trong SQLite là TEXT tự do; hợp đồng khai union 3 vai trò.
    // `roleOf()` đưa mọi giá trị lạ/rỗng về 'viewer' (hẹp nhất) thay vì ép
    // kiểu bừa — cùng quy tắc mà renderer dùng, xem `page-roles.ts`.
    role: roleOf(row.role),
    pagePerms: parsePagePerms(row.page_perms_json), active: !!row.active, mustChangePassword: !!row.must_change_password,
    avatar: row.avatar || '',
  };
}

function forbidden(message = 'Chỉ quản trị viên mới được thực hiện thao tác này.'): IpcResult<never> {
  return { ok: false, error: { code: 'forbidden', message } };
}

export function createAuthHandlers(db: Db) {
  function hasAnyUsers(): boolean {
    return (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c > 0;
  }

  /** Đọc lại 1 tài khoản từ DB theo id — dùng cho `auth:currentUser`. Phải
   * đọc DB, KHÔNG dựng object từ `sessionActor`: `Actor` chỉ có id/username/
   * name/role, thiếu `pagePerms`, nên dựng tay sẽ làm renderer tưởng tài
   * khoản không bị thu hẹp quyền và hiện đủ menu sau mỗi lần reload cửa sổ.
   * Đọc DB cũng khiến admin sửa quyền của ai đó có hiệu lực ngay ở lần
   * renderer nạp lại, không cần đăng xuất. */
  function getUser(id: string): PublicUser | null {
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined;
    return row ? toPublicUser(row) : null;
  }

  function listUsers(actor: Actor): IpcResult<PublicUser[]> {
    if (actor.role !== 'admin') return forbidden();
    const rows = db.prepare('SELECT * FROM users ORDER BY username').all() as unknown as UserRow[];
    return { ok: true, data: rows.map(toPublicUser) };
  }

  /** Chỉ dùng đúng 1 lần khi bảng `users` còn rỗng — tạo tài khoản quản trị
   * đầu tiên mà KHÔNG cần actor có sẵn (chưa ai đăng nhập được vì chưa có
   * user nào). Actor ghi audit chính là tài khoản vừa tạo.
   *
   * Mọi hàm băm mật khẩu dưới đây đều bất đồng bộ (xem `login`) và băm TRƯỚC
   * khi mở transaction để transaction ngắn. Trong lúc chờ băm, lời gọi khác
   * có thể chen vào, nên điều kiện đã kiểm trước đó được kiểm lại sau `await`. */
  async function bootstrapAdmin(input: { data: UserCreateInput }): Promise<IpcResult<PublicUser>> {
    const already: IpcResult<never> = { ok: false, error: { code: 'already-bootstrapped', message: 'Hệ thống đã có tài khoản, không thể khởi tạo lại.' } };
    if (hasAnyUsers()) return already;
    const result = validateUserCreate(input.data, []);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { username, name, initials, password } = result.data;
    const id = uid();
    const passHash = await hashPasswordAsync(password);
    // Hai lần bấm "Khởi tạo" dồn nhau không được tạo hai tài khoản quản trị.
    if (hasAnyUsers()) return already;
    const row = withTransaction(db, () => {
      db.prepare('INSERT INTO users(id,username,name,initials,role,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,?,1,0)')
        .run(id, username, name, initials, 'admin', passHash);
      writeAudit(db, { userId: id, username, name, role: 'admin', clientId: 'bootstrap' }, 'Khởi tạo tài khoản quản trị', `Tạo tài khoản quản trị đầu tiên "${username}"`, username);
      return db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as UserRow;
    });
    return { ok: true, data: toPublicUser(row) };
  }

  /** Bất đồng bộ vì đây là cổng KHÔNG cần đăng nhập, mở cả qua LAN: mỗi lần
   * thử phải băm 600.000 vòng, chạy đồng bộ thì vài yêu cầu dồn dập đủ làm đơ
   * main process. Chỉ phần băm là chờ; đọc và ghi SQLite vẫn đồng bộ. */
  async function login(input: { data: LoginInput }): Promise<IpcResult<PublicUser>> {
    const result = validateLoginInput(input.data);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { username, password } = result.data;
    const stored = db.prepare('SELECT pass_hash FROM users WHERE username=?').get(username) as { pass_hash: string } | undefined;
    const passwordOk = !!stored && await verifyPasswordAsync(password, stored.pass_hash);
    // Đọc lại SAU khi chờ băm: trong lúc đó admin có thể vừa khoá tài khoản
    // hoặc đổi mật khẩu, nên kết luận phải dựa trên hàng hiện tại.
    const row = db.prepare('SELECT * FROM users WHERE username=?').get(username) as UserRow | undefined;
    if (!row || !passwordOk || row.pass_hash !== stored?.pass_hash) {
      return { ok: false, error: { code: 'invalid-credentials', message: 'Sai tên đăng nhập hoặc mật khẩu.' } };
    }
    if (!row.active) return { ok: false, error: { code: 'inactive', message: 'Tài khoản đã bị khoá.' } };
    writeAudit(db, { userId: row.id, username: row.username, name: row.name, role: row.role, clientId: 'app-desktop' }, 'Đăng nhập', `Đăng nhập thành công`, row.username);
    return { ok: true, data: toPublicUser(row) };
  }

  async function createUser(input: { data: UserCreateInput }, actor: Actor): Promise<IpcResult<PublicUser>> {
    if (actor.role !== 'admin') return forbidden();
    const existingUsernames = () => (db.prepare('SELECT username FROM users').all() as { username: string }[]).map(r => r.username);
    const result = validateUserCreate(input.data, existingUsernames());
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const { username, name, initials, role, password, pagePerms } = result.data;
    const id = uid();
    const passHash = await hashPasswordAsync(password);
    // Kiểm trùng tên lần nữa: một lần tạo khác cùng tên có thể vừa xong.
    const recheck = validateUserCreate(input.data, existingUsernames());
    if (!recheck.ok) return { ok: false, error: { code: recheck.code, message: recheck.message } };
    withTransaction(db, () => {
      db.prepare('INSERT INTO users(id,username,name,initials,role,page_perms_json,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,?,?,1,1)')
        .run(id, username, name, initials, role, JSON.stringify(pagePerms), passHash);
      writeAudit(db, actor, 'Thêm người dùng', `Tạo tài khoản "${username}": ${roleLabel(role)} · ${pagePerms.length} thẻ · yêu cầu đổi mật khẩu`, username);
    });
    notifyChanged(['users']);
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
    const { name, role, active, initials, pagePerms } = result.data;
    if (wouldRemoveLastActiveAdmin(db, id, role, active)) {
      return { ok: false, error: { code: 'last-admin', message: 'Phải còn ít nhất 1 quản trị viên đang hoạt động.' } };
    }
    // Tự sửa quyền của CHÍNH MÌNH bị chặn (hệ thống: openUserPerms/applyUserPerms
    // đều từ chối) — một admin hạ quyền chính mình rồi mất luôn trang Người
    // dùng là không tự cứu được. Đổi tên/khoá thì không rơi vào đây.
    if (id === actor.userId && (pagePerms !== undefined || role !== existing.role)) {
      return { ok: false, error: { code: 'self-perms', message: 'Không thể tự sửa quyền của tài khoản đang đăng nhập. Hãy dùng tài khoản quản trị khác nếu cần thay đổi.' } };
    }
    const permsText = pagePerms !== undefined ? ` · ${pagePerms.length} thẻ` : '';
    withTransaction(db, () => {
      db.prepare('UPDATE users SET name=?, initials=?, role=?, active=? WHERE id=?').run(name, initials, role, active ? 1 : 0, id);
      // `pagePerms` là field tuỳ chọn: thiếu field nghĩa là giữ nguyên, không phải xoá.
      if (pagePerms !== undefined) db.prepare('UPDATE users SET page_perms_json=? WHERE id=?').run(JSON.stringify(pagePerms), id);
      writeAudit(db, actor, 'Sửa người dùng', `Cập nhật "${existing.username}": ${roleLabel(role)}${permsText}, ${active ? 'hoạt động' : 'đã khoá'}`, existing.username);
    });
    notifyChanged(['users']);
    return { ok: true, data: toPublicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id) as unknown as UserRow) };
  }

  /** Admin đặt lại mật khẩu cho người khác — luôn bật must_change_password
   * để buộc đổi lại ở lần đăng nhập kế tiếp, không âm thầm giữ mật khẩu admin
   * vừa gõ làm mật khẩu lâu dài của người dùng. */
  async function resetPassword(input: { id: unknown; data: { newPassword?: unknown } }, actor: Actor): Promise<IpcResult<{ id: string }>> {
    if (actor.role !== 'admin') return forbidden();
    const id = String(input.id || '');
    const notFound: IpcResult<never> = { ok: false, error: { code: 'not-found', message: 'Không tìm thấy người dùng.' } };
    const existing = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined;
    if (!existing) return notFound;
    const result = validateNewPassword(input.data?.newPassword);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const passHash = await hashPasswordAsync(result.data);
    // Tài khoản có thể vừa bị xoá trong lúc băm.
    if (!db.prepare('SELECT 1 FROM users WHERE id=?').get(id)) return notFound;
    withTransaction(db, () => {
      db.prepare('UPDATE users SET pass_hash=?, must_change_password=1 WHERE id=?').run(passHash, id);
      writeAudit(db, actor, 'Đặt lại mật khẩu', `Đặt lại mật khẩu cho "${existing.username}"`, existing.username);
    });
    notifyChanged(['users']);
    return { ok: true, data: { id } };
  }


  async function verifyOwnPassword(input: { data: { password?: unknown } }, actor: Actor): Promise<IpcResult<{ ok: true }>> {
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(actor.userId) as UserRow | undefined;
    if (!row || !await verifyPasswordAsync(String(input.data?.password || ''), row.pass_hash)) {
      return { ok: false, error: { code: 'wrong-password', message: 'Mật khẩu không đúng.' } };
    }
    return { ok: true, data: { ok: true } };
  }

  async function changeOwnPassword(input: { data: { oldPassword?: unknown; newPassword?: unknown } }, actor: Actor): Promise<IpcResult<{ id: string }>> {
    const row = db.prepare('SELECT * FROM users WHERE id=?').get(actor.userId) as UserRow | undefined;
    if (!row) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy tài khoản.' } };
    const wrong: IpcResult<never> = { ok: false, error: { code: 'wrong-password', message: 'Mật khẩu hiện tại không đúng.' } };
    if (!await verifyPasswordAsync(String(input.data?.oldPassword || ''), row.pass_hash)) return wrong;
    const result = validateNewPassword(input.data?.newPassword);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const passHash = await hashPasswordAsync(result.data);
    // Mật khẩu có thể vừa bị admin đặt lại trong lúc băm: mật khẩu cũ vừa
    // kiểm không còn là mật khẩu hiện hành, không được ghi đè.
    const current = db.prepare('SELECT pass_hash FROM users WHERE id=?').get(row.id) as { pass_hash: string } | undefined;
    if (current?.pass_hash !== row.pass_hash) return wrong;
    withTransaction(db, () => {
      db.prepare('UPDATE users SET pass_hash=?, must_change_password=0 WHERE id=?').run(passHash, row.id);
      writeAudit(db, actor, 'Đổi mật khẩu', `Tự đổi mật khẩu`, row.username);
    });
    return { ok: true, data: { id: row.id } };
  }

  /** Đổi/xoá ảnh đại diện — LUÔN tự phục vụ (chỉ trên `actor.userId`, không
   * nhận id người khác) khớp `avatar-modal-controller.ts` hệ thống: avatar chỉ
   * đổi được cho chính tài khoản đang đăng nhập, không phải thao tác quản
   * trị. Renderer đã resize về canvas 160×160 trước khi gửi lên (giữ đúng
   * "Ảnh sẽ được cắt vuông và thu nhỏ tự động" của hệ thống) — main không resize
   * lại, chỉ validate hình dạng data URL. */
  function setAvatar(input: { data: { dataUrl?: unknown } }, actor: Actor): IpcResult<{ avatar: string }> {
    const result = validateSetAvatar(input.data?.dataUrl);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    withTransaction(db, () => {
      db.prepare('UPDATE users SET avatar=? WHERE id=?').run(result.data, actor.userId);
      writeAudit(db, actor, 'Cập nhật ảnh đại diện', 'Đổi ảnh đại diện cá nhân', actor.username);
    });
    notifyChanged(['users']);
    return { ok: true, data: { avatar: result.data } };
  }

  function clearAvatar(actor: Actor): IpcResult<{ avatar: string }> {
    withTransaction(db, () => {
      db.prepare("UPDATE users SET avatar='' WHERE id=?").run(actor.userId);
      writeAudit(db, actor, 'Cập nhật ảnh đại diện', 'Xoá ảnh đại diện cá nhân', actor.username);
    });
    notifyChanged(['users']);
    return { ok: true, data: { avatar: '' } };
  }


  function deleteUser(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    if (actor.role !== 'admin') return forbidden();
    const id = String(input.id || '');
    const existing = db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy người dùng.' } };
    if (id === actor.userId) {
      return { ok: false, error: { code: 'self-delete', message: 'Không thể tự xoá tài khoản đang đăng nhập.' } };
    }
    if (wouldRemoveLastActiveAdmin(db, id, 'viewer', false)) {
      return { ok: false, error: { code: 'last-admin', message: 'Phải còn ít nhất 1 quản trị viên đang hoạt động.' } };
    }
    withTransaction(db, () => {
      db.prepare('DELETE FROM users WHERE id=?').run(id);
      writeAudit(db, actor, 'Xoá người dùng', `Xoá tài khoản "${existing.username}" (${roleLabel(existing.role)})`, existing.username);
    });
    notifyChanged(['users']);
    return { ok: true, data: { id } };
  }

  return { hasAnyUsers, getUser, listUsers, bootstrapAdmin, login, createUser, updateUser, deleteUser, resetPassword, changeOwnPassword, verifyOwnPassword, setAvatar, clearAvatar };
}

export type AuthHandlers = ReturnType<typeof createAuthHandlers>;


