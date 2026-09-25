// Băm mật khẩu bất đồng bộ (kế hoạch E.1): tạo tài khoản, đặt lại, đổi và
// kiểm mật khẩu không được chặn main process — trước đây 600.000 vòng PBKDF2
// chạy đồng bộ làm đơ cửa sổ desktop và máy chủ LAN vài trăm ms mỗi lần.
// Vì handler giờ nhả event loop giữa chừng, điều kiện kiểm trước khi băm phải
// được kiểm lại sau khi băm.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { hashPassword } = require('../../app-dist/main/domain/password-hash.js');

async function setup() {
  const db = openDatabase(':memory:');
  const auth = createAuthHandlers(db);
  const boot = await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị viên', password: 'mat-khau-dai-1' } });
  const admin = { userId: boot.data.id, username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test' };
  const created = await auth.createUser({ data: { username: 'ktv1', name: 'Nguyễn Văn A', role: 'technician', password: 'ktv-pass-123' } }, admin);
  const ktv = { userId: created.data.id, username: 'ktv1', name: 'Nguyễn Văn A', role: 'technician', clientId: 'test' };
  return { db, auth, admin, ktv };
}

/** Event loop phải chạy được ít nhất một lượt trước khi handler xong. Bản
 * đồng bộ tính xong ngay trong lời gọi, nên `.then` chạy trước `setImmediate`. */
async function assertYields(label, start) {
  let settled = false;
  const pending = start().then((result) => { settled = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, `${label}: event loop phải chạy trong lúc băm mật khẩu`);
  return pending;
}

test('mọi thao tác băm mật khẩu nhả event loop', async () => {
  const db = openDatabase(':memory:');
  const auth = createAuthHandlers(db);
  const boot = await assertYields('bootstrapAdmin', () => auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị viên', password: 'mat-khau-dai-1' } }));
  assert.equal(boot.ok, true);
  const admin = { userId: boot.data.id, username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test' };
  const created = await assertYields('createUser', () => auth.createUser({ data: { username: 'ktv1', name: 'Nguyễn Văn A', role: 'technician', password: 'ktv-pass-123' } }, admin));
  assert.equal(created.ok, true);
  const ktv = { userId: created.data.id, username: 'ktv1', name: 'Nguyễn Văn A', role: 'technician', clientId: 'test' };
  assert.equal((await assertYields('resetPassword', () => auth.resetPassword({ id: ktv.userId, data: { newPassword: 'mat-khau-moi-1' } }, admin))).ok, true);
  assert.equal((await assertYields('verifyOwnPassword', () => auth.verifyOwnPassword({ data: { password: 'mat-khau-moi-1' } }, ktv))).ok, true);
  assert.equal((await assertYields('changeOwnPassword', () => auth.changeOwnPassword({ data: { oldPassword: 'mat-khau-moi-1', newPassword: 'mat-khau-moi-2' } }, ktv))).ok, true);
  assert.equal((await auth.login({ data: { username: 'ktv1', password: 'mat-khau-moi-2' } })).ok, true, 'mật khẩu mới dùng được');
});

test('hai lần khởi tạo quản trị dồn nhau chỉ tạo một tài khoản', async () => {
  const db = openDatabase(':memory:');
  const auth = createAuthHandlers(db);
  const input = (username) => ({ data: { username, name: 'Quản trị viên', password: 'mat-khau-dai-1' } });
  const results = await Promise.all([auth.bootstrapAdmin(input('admin')), auth.bootstrapAdmin(input('admin2'))]);
  assert.deepEqual(results.map((r) => r.ok).sort(), [false, true]);
  assert.equal(results.find((r) => !r.ok).error.code, 'already-bootstrapped');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n, 1);
});

test('hai lần tạo cùng tên đăng nhập dồn nhau: một thành công, một báo trùng', async () => {
  const { db, auth, admin } = await setup();
  const input = { data: { username: 'ktv2', name: 'Trần B', role: 'technician', password: 'ktv-pass-123' } };
  const results = await Promise.all([auth.createUser(input, admin), auth.createUser(input, admin)]);
  assert.deepEqual(results.map((r) => r.ok).sort(), [false, true]);
  assert.equal(results.find((r) => !r.ok).error.code, 'duplicate-username', 'báo lỗi nghiệp vụ, không phải lỗi UNIQUE của SQLite');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM users WHERE username='ktv2'").get().n, 1);
});

test('đặt lại mật khẩu cho tài khoản bị xoá trong lúc băm: báo không tìm thấy, không ghi nhật ký', async () => {
  const { db, auth, admin, ktv } = await setup();
  const pending = auth.resetPassword({ id: ktv.userId, data: { newPassword: 'mat-khau-moi-1' } }, admin);
  assert.equal(auth.deleteUser({ id: ktv.userId }, admin).ok, true);
  assert.equal((await pending).error.code, 'not-found');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM activity WHERE type='Đặt lại mật khẩu'").get().n, 0);
});

test('tự đổi mật khẩu không ghi đè mật khẩu admin vừa đặt lại trong lúc băm', async () => {
  const { db, auth, ktv } = await setup();
  const change = auth.changeOwnPassword({ data: { oldPassword: 'ktv-pass-123', newPassword: 'ktv-tu-doi-1' } }, ktv);
  // Handler đã đọc mật khẩu hiện hành và đang chờ băm: mật khẩu đổi đúng lúc
  // này (như admin vừa bấm "Đặt lại"). Ghi thẳng SQL để thứ tự là tất định.
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(hashPassword('admin-dat-lai-1'), ktv.userId);
  const changed = await change;
  assert.equal(changed.ok, false);
  assert.equal(changed.error.code, 'wrong-password');
  assert.equal((await auth.login({ data: { username: 'ktv1', password: 'admin-dat-lai-1' } })).ok, true, 'mật khẩu admin đặt lại được giữ');
  assert.equal((await auth.login({ data: { username: 'ktv1', password: 'ktv-tu-doi-1' } })).ok, false);
});
