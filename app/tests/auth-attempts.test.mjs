// A10: đăng nhập không để lộ tài khoản có tồn tại qua thời gian trả lời, và
// xác thực lại / tự đổi mật khẩu có giới hạn số lần nhập sai.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { pbkdf2Sync } from 'node:crypto';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');

/** Hash ít vòng cho test chạy nhanh; định dạng giống hash thật. */
const quickHash = (password) => `pbkdf2$1000$${'ab'.repeat(16)}$${pbkdf2Sync(password, 'ab'.repeat(16), 1000, 32, 'sha256').toString('hex')}`;

function setup() {
  const db = openDatabase(':memory:');
  let clock = 1_000_000;
  const auth = createAuthHandlers(db, () => clock);
  db.prepare('INSERT INTO users(id,username,name,initials,role,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,?,?,?)')
    .run('u1', 'ktv1', 'KTV', 'KT', 'technician', quickHash('dung-mat-khau'), 1, 0);
  const actor = { userId: 'u1', username: 'ktv1', name: 'KTV', role: 'technician', clientId: 'test' };
  return { db, auth, actor, advance: (ms) => { clock += ms; } };
}

test('tên đăng nhập không tồn tại vẫn băm mật khẩu như sai mật khẩu', async () => {
  const { auth } = setup();
  // Trước đây nhánh này trả ngay, không băm: xong trước cả lượt event loop kế tiếp.
  let settled = false;
  const pending = auth.login({ data: { username: 'khong-co-ai', password: 'bat-ky-123' } }).then((result) => { settled = true; return result; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false, 'phải chờ băm như tài khoản có thật');
  const result = await pending;
  assert.equal(result.error.code, 'invalid-credentials', 'cùng mã lỗi với sai mật khẩu');
});

test('xác thực lại: 5 lần sai thì khoá 15 phút, kể cả khi nhập đúng', async () => {
  const { auth, actor, advance } = setup();
  const verify = (password) => auth.verifyOwnPassword({ data: { password } }, actor);
  for (let i = 0; i < 5; i += 1) assert.equal((await verify('sai')).error.code, 'wrong-password');
  const locked = await verify('dung-mat-khau');
  assert.equal(locked.error.code, 'too-many-attempts');
  assert.match(locked.error.message, /Thử lại sau 15 phút/);
  advance(15 * 60 * 1000 + 1);
  assert.equal((await verify('dung-mat-khau')).ok, true, 'hết thời gian khoá thì dùng lại được');
});

test('nhập đúng thì xoá bộ đếm; tự đổi mật khẩu dùng chung bộ đếm', async () => {
  const { auth, actor } = setup();
  const verify = (password) => auth.verifyOwnPassword({ data: { password } }, actor);
  for (let i = 0; i < 4; i += 1) await verify('sai');
  assert.equal((await verify('dung-mat-khau')).ok, true);
  for (let i = 0; i < 4; i += 1) assert.equal((await verify('sai')).error.code, 'wrong-password', 'đếm lại từ đầu');
  const change = await auth.changeOwnPassword({ data: { oldPassword: 'sai', newPassword: 'mat-khau-moi-123' } }, actor);
  assert.equal(change.error.code, 'wrong-password', 'lần sai thứ 5');
  const blocked = await auth.changeOwnPassword({ data: { oldPassword: 'dung-mat-khau', newPassword: 'mat-khau-moi-123' } }, actor);
  assert.equal(blocked.error.code, 'too-many-attempts', 'đổi mật khẩu không dùng để dò tiếp được');
  assert.equal((await verify('dung-mat-khau')).error.code, 'too-many-attempts');
});

test('khoá theo tài khoản: tài khoản khác không bị ảnh hưởng', async () => {
  const { db, auth, actor } = setup();
  db.prepare('INSERT INTO users(id,username,name,initials,role,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,?,?,?)')
    .run('u2', 'ktv2', 'KTV 2', 'K2', 'technician', quickHash('mat-khau-2'), 1, 0);
  for (let i = 0; i < 5; i += 1) await auth.verifyOwnPassword({ data: { password: 'sai' } }, actor);
  const other = { ...actor, userId: 'u2', username: 'ktv2' };
  assert.equal((await auth.verifyOwnPassword({ data: { password: 'mat-khau-2' } }, other)).ok, true);
});
