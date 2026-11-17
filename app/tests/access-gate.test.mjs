// GV5: cổng quyền ở main (`ipc/access-gate.ts`) đọc lại tài khoản ở MỖI lời
// gọi. Trước đây vai trò chụp lúc đăng nhập dùng suốt phiên, quyền theo trang
// chỉ ẩn menu ở renderer, nhiều thao tác đọc không đòi đăng nhập, và cờ phải
// đổi mật khẩu không được main kiểm.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAccessGate, channelPages, isPublicChannel } = require('../../app-dist/main/ipc/access-gate.js');
const { AccessError, NotSignedInError, createBusinessOperations, createLanInvoker, registerIpcOperations, sessionContext } = require('../../app-dist/main/ipc/operations.js');
const { createDesktopOperations } = require('../../app-dist/main/ipc/desktop-operations.js');
const { PAGE_DEFS } = require('../../app-dist/main/domain/page-roles.js');

function setup() {
  const db = openDatabase(':memory:');
  const add = db.prepare('INSERT INTO users(id,username,name,initials,role,page_perms_json,pass_hash,active,must_change_password) VALUES (?,?,?,?,?,?,?,?,?)');
  add.run('admin', 'admin', 'Quản trị', 'QT', 'admin', null, 'h-admin', 1, 0);
  add.run('ktv', 'ktv', 'Kỹ thuật viên', 'KT', 'technician', null, 'h-ktv', 1, 0);
  add.run('viewer', 'viewer', 'Người xem', 'NX', 'viewer', null, 'h-viewer', 1, 0);
  return { db, gate: createAccessGate(db) };
}
const actorOf = (userId, role) => ({ userId, username: userId, name: userId, role, clientId: 'test' });
const ctxOf = (actor) => sessionContext(() => actor);

test('kênh công khai chạy khi chưa đăng nhập; kênh khác đòi đăng nhập', () => {
  const { gate } = setup();
  const none = ctxOf(null);
  for (const channel of ['auth:hasAnyUsers', 'auth:login', 'auth:currentUser', 'settings:getLoginBrand', 'log:clientError']) {
    assert.doesNotThrow(() => gate.guard(channel, none), channel);
  }
  // Trước GV5 các thao tác đọc này không gọi `ctx.actor()`: người chưa đăng
  // nhập ở máy chính đọc được báo cáo qua DevTools.
  for (const channel of ['report:queryReport', 'config:listTests', 'entry:queryPoints', 'westgard:listTestSummaries', 'settings:getLabProfile']) {
    assert.throws(() => gate.guard(channel, none), NotSignedInError, channel);
  }
});

test('tài khoản bị khoá hoặc bị xoá thì coi như chưa đăng nhập ngay ở lời gọi kế tiếp', () => {
  const { db, gate } = setup();
  const ctx = ctxOf(actorOf('ktv', 'technician'));
  assert.doesNotThrow(() => gate.guard('entry:queryPoints', ctx));
  db.prepare('UPDATE users SET active=0 WHERE id=?').run('ktv');
  assert.throws(() => gate.guard('entry:queryPoints', ctx), NotSignedInError);
  db.prepare('DELETE FROM users WHERE id=?').run('ktv');
  assert.throws(() => gate.guard('entry:queryPoints', ctx), NotSignedInError);
});

test('handler nhận vai trò mới nhất trong CSDL, không phải vai trò lúc đăng nhập', () => {
  const { db, gate } = setup();
  const ctx = ctxOf(actorOf('ktv', 'admin'));
  assert.equal(gate.guard('entry:queryPoints', ctx).actor().role, 'technician');
  db.prepare("UPDATE users SET role='viewer', name='Đã đổi tên' WHERE id='ktv'").run();
  const fresh = gate.guard('entry:queryPoints', ctx).actor();
  assert.equal(fresh.role, 'viewer');
  assert.equal(fresh.name, 'Đã đổi tên');
  assert.equal(fresh.clientId, 'test', 'giữ nơi đăng nhập của phiên');
});

test('đang phải đổi mật khẩu: chỉ cho đổi mật khẩu và các kênh công khai', () => {
  const { db, gate } = setup();
  db.prepare('UPDATE users SET must_change_password=1 WHERE id=?').run('ktv');
  const ctx = ctxOf(actorOf('ktv', 'technician'));
  assert.doesNotThrow(() => gate.guard('auth:changeOwnPassword', ctx));
  assert.doesNotThrow(() => gate.guard('auth:currentUser', ctx));
  assert.doesNotThrow(() => gate.guard('auth:logout', ctx));
  for (const channel of ['entry:addPoint', 'config:listTests', 'auth:verifyPassword']) {
    assert.throws(() => gate.guard(channel, ctx), (error) => error instanceof AccessError && error.code === 'password-change-required', channel);
  }
});

test('quyền theo trang được chặn ở main, không chỉ ẩn menu', () => {
  const { db, gate } = setup();
  // KTV chỉ được mở Nhập QC và Westgard.
  db.prepare('UPDATE users SET page_perms_json=? WHERE id=?').run(JSON.stringify(['entry', 'westgard']), 'ktv');
  const ktv = ctxOf(actorOf('ktv', 'technician'));
  assert.doesNotThrow(() => gate.guard('entry:addPoint', ktv));
  assert.doesNotThrow(() => gate.guard('config:listTests', ktv), 'danh mục dùng chung mọi trang');
  for (const channel of ['sigma:listPeriods', 'reagent:saveRows', 'report:queryReport', 'nce:get', 'eqa:listRounds']) {
    assert.throws(() => gate.guard(channel, ktv), (error) => error instanceof AccessError && error.code === 'forbidden', channel);
  }
  // Tóm tắt NCE vẫn đọc được: Tổng quan và Báo cáo dùng nó.
  assert.doesNotThrow(() => gate.guard('nce:list', ktv));
  // Người chỉ xem không vào Cấu hình chung, Nhật ký hay Người dùng.
  const viewer = ctxOf(actorOf('viewer', 'viewer'));
  for (const channel of ['config:saveTest', 'audit:query', 'auth:listUsers', 'backup:export']) {
    assert.throws(() => gate.guard(channel, viewer), AccessError, channel);
  }
  // Một kênh dùng ở hai trang: vào được một trong hai là đủ.
  db.prepare('UPDATE users SET page_perms_json=? WHERE id=?').run(JSON.stringify(['sigma']), 'ktv');
  assert.doesNotThrow(() => gate.guard('report:getTemplateSettings', ktv));
  db.prepare('UPDATE users SET page_perms_json=? WHERE id=?').run(JSON.stringify(['eqa']), 'ktv');
  assert.doesNotThrow(() => gate.guard('report:getTemplateSettings', ktv));
});

test('bảng quy tắc khớp đúng kênh và trang đang có', () => {
  const tables = [createBusinessOperations({}), createDesktopOperations({}, { session: { get: () => null, set: () => {} } })];
  const channels = new Set(tables.flatMap((table) => Object.values(table).map((op) => op.channel)));
  const pageIds = new Set(PAGE_DEFS.map((page) => page.id));
  for (const channel of channels) {
    const pages = channelPages(channel);
    if (pages) for (const page of pages) assert.ok(pageIds.has(page), `${channel} → trang lạ ${page}`);
  }
  // Mọi kênh công khai đều có thật, không lệch tên.
  for (const channel of ['auth:hasAnyUsers', 'auth:currentUser', 'auth:bootstrapAdmin', 'auth:login', 'auth:logout', 'settings:getLoginBrand', 'log:clientError']) {
    assert.ok(channels.has(channel) && isPublicChannel(channel), channel);
  }
  // Thao tác ghi của Cấu hình chung đều thuộc trang Cấu hình chung.
  for (const channel of channels) {
    if (channel.startsWith('config:') && !channel.startsWith('config:list')) assert.deepEqual(channelPages(channel), ['manage'], channel);
  }
});

test('IPC và RPC của LAN đều đi qua cổng; thao tác đọc bị chặn trả lỗi rõ ràng qua LAN', async () => {
  const { db, gate } = setup();
  const table = {
    listTests: { channel: 'config:listTests', lan: true, run: (ctx) => [ctx.actor().role] },
    queryReport: { channel: 'report:queryReport', lan: true, run: () => [] },
    saveTest: { channel: 'config:saveTest', lan: true, run: (ctx) => ({ ok: true, data: ctx.actor().role }) },
  };
  const handlers = new Map();
  registerIpcOperations({ handle: (channel, fn) => handlers.set(channel, fn) }, [table], ctxOf(actorOf('ktv', 'admin')), gate);
  assert.deepEqual(await handlers.get('config:listTests')(), ['technician'], 'IPC chạy với vai trò mới nhất');
  const saved = await handlers.get('config:saveTest')();
  assert.equal(saved.ok, false);
  assert.equal(saved.error.code, 'forbidden', 'KTV không vào Cấu hình chung');

  const lan = createLanInvoker([table], gate);
  db.prepare('UPDATE users SET page_perms_json=? WHERE id=?').run(JSON.stringify(['entry']), 'ktv');
  const denied = await lan('queryReport', [], actorOf('ktv', 'technician'));
  assert.equal(denied.readFailed, true, 'thao tác đọc bị chặn: đánh dấu để client ném lỗi');
  assert.equal(denied.error.code, 'forbidden');
  db.prepare('UPDATE users SET active=0 WHERE id=?').run('ktv');
  const locked = await lan('listTests', [], actorOf('ktv', 'technician'));
  assert.equal(locked.error.code, 'unauthenticated', 'máy chủ LAN đổi mã này thành 401');
});

test('bản đóng gói: không DevTools, không menu mặc định, không nhận dev server từ biến môi trường', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('../main/index.ts', import.meta.url), 'utf8');
  assert.match(source, /const DEV_SERVER_URL = app\.isPackaged \? undefined : process\.env\.QCLAB_DEV_SERVER_URL;/);
  assert.match(source, /const DEV_TOOLS = !app\.isPackaged;/);
  assert.equal(source.match(/devTools: DEV_TOOLS/g)?.length, 2, 'cửa sổ chính và cửa sổ con');
  assert.match(source, /if \(app\.isPackaged\) Menu\.setApplicationMenu\(null\);/);
  assert.match(source, /registerIpcOperations\(ipcMain, operationTables, sessionContext\(\(\) => sessionActor\), accessGate\)/);
  assert.match(source, /invoke: createLanInvoker\(operationTables, accessGate\)/);
  assert.match(source, /sessionCheck: createSessionCheck\(db\)/);
});

test('renderer: tài khoản phải đổi mật khẩu thấy màn đổi mật khẩu thay cho khung chính', async () => {
  const { readFileSync } = await import('node:fs');
  const router = readFileSync(new URL('../renderer/router.tsx', import.meta.url), 'utf8');
  assert.match(router, /if \(user\?\.mustChangePassword\) return <ChangePasswordPage \/>;/);
  const users = readFileSync(new URL('../renderer/pages/UsersPage.tsx', import.meta.url), 'utf8');
  assert.match(users, /resetFor\.id === me\?\.id\s*\? <OwnPasswordModal/, 'tự đổi mật khẩu không dùng hộp đặt lại của admin');
});
