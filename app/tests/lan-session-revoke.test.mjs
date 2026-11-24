// GV5: phiên LAN bị thu hồi ngay ở yêu cầu kế tiếp khi tài khoản bị khoá, bị
// xoá hoặc đổi mật khẩu (kể cả do phục hồi bản sao lưu). Trước đây phiên giữ
// nguyên actor lúc đăng nhập suốt 8 giờ; chỉ đăng xuất mới thu hồi.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { trustedTestTls } from './helpers/lan-tls.mjs';
const require = createRequire(import.meta.url);

const { LanHttpServer } = require('../../app-dist/main/lan/http-server.js');
const { createSessionCheck } = require('../../app-dist/main/lan/session-check.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { source: tls } = trustedTestTls();

async function start() {
  const db = openDatabase(':memory:');
  db.prepare("INSERT INTO users(id,username,name,initials,role,pass_hash,active,must_change_password) VALUES ('u1','ktv','KTV','KT','technician','hash-1',1,0)").run();
  const seen = [];
  let nextResult = null;
  const server = new LanHttpServer({
    login: () => ({ ok: true, data: { id: 'u1', username: 'ktv', name: 'KTV', role: 'technician' } }),
    actorOf: (row, clientId) => ({ userId: row.id, username: row.username, name: row.name, role: row.role, clientId }),
    currentUser: (actor) => ({ id: actor.userId, role: actor.role }),
    sessionCheck: createSessionCheck(db),
    invoke: async (method, _args, actor) => {
      seen.push(actor.role);
      // Handler đổi mật khẩu thật ghi `pass_hash` mới TRONG yêu cầu, sau bước kiểm phiên.
      if (method === 'changeOwnPassword') { db.prepare("UPDATE users SET pass_hash='hash-3' WHERE id='u1'").run(); return { ok: true, data: { id: 'u1' } }; }
      return nextResult ?? { ok: true, data: method };
    },
    tls,
  });
  const port = await server.start(0, '127.0.0.1');
  const origin = `https://127.0.0.1:${port}`;
  const login = async () => (await fetch(`${origin}/api/auth/login`, { method: 'POST', body: '{}' })).headers.get('set-cookie').split(';')[0];
  const rpc = (cookie, method = 'listTests') => fetch(`${origin}/api/rpc`, { method: 'POST', headers: { cookie }, body: JSON.stringify({ method, args: [] }) });
  const session = (cookie) => fetch(`${origin}/api/session`, { headers: { cookie } });
  return { db, server, origin, login, rpc, session, seen, setNext: (value) => { nextResult = value; } };
}

test('khoá tài khoản thì phiên đang mở bị từ chối ngay và không dùng lại được', async () => {
  const t = await start();
  try {
    const cookie = await t.login();
    assert.equal((await t.rpc(cookie)).status, 200);
    t.db.prepare("UPDATE users SET active=0 WHERE id='u1'").run();
    assert.equal((await t.rpc(cookie)).status, 401);
    t.db.prepare("UPDATE users SET active=1 WHERE id='u1'").run();
    assert.equal((await t.rpc(cookie)).status, 401, 'mở khoá lại cũng không hồi sinh phiên đã thu hồi');
    assert.equal((await t.session(cookie)).status, 401);
  } finally { await t.server.stop(); }
});

test('xoá tài khoản hoặc đổi mật khẩu (đặt lại, phục hồi bản sao lưu) thu hồi phiên', async () => {
  const t = await start();
  try {
    const a = await t.login();
    t.db.prepare("UPDATE users SET pass_hash='hash-2' WHERE id='u1'").run();
    assert.equal((await t.rpc(a)).status, 401, 'mật khẩu đổi');
    const b = await t.login();
    assert.equal((await t.rpc(b)).status, 200, 'đăng nhập lại bằng mật khẩu mới thì dùng được');
    t.db.prepare("DELETE FROM users WHERE id='u1'").run();
    assert.equal((await t.rpc(b)).status, 401, 'tài khoản bị xoá');
  } finally { await t.server.stop(); }
});

test('hạ quyền có hiệu lực ngay ở yêu cầu kế tiếp, không chờ đăng nhập lại', async () => {
  const t = await start();
  try {
    const cookie = await t.login();
    await t.rpc(cookie);
    t.db.prepare("UPDATE users SET role='viewer' WHERE id='u1'").run();
    await t.rpc(cookie);
    assert.deepEqual(t.seen, ['technician', 'viewer']);
    assert.equal((await (await t.session(cookie)).json()).data.role, 'viewer');
  } finally { await t.server.stop(); }
});

test('tự đổi mật khẩu giữ phiên đang dùng, các phiên khác của tài khoản bị thu hồi', async () => {
  const t = await start();
  try {
    const mine = await t.login();
    const other = await t.login();
    assert.equal((await t.rpc(mine, 'changeOwnPassword')).status, 200);
    assert.equal((await t.rpc(mine)).status, 200, 'phiên vừa đổi mật khẩu vẫn dùng tiếp');
    assert.equal((await t.rpc(other)).status, 401, 'phiên khác (máy khác) phải đăng nhập lại');
  } finally { await t.server.stop(); }
});

test('cổng quyền báo chưa đăng nhập thì trả 401 và thu hồi phiên; luồng sự kiện cũng kiểm phiên', async () => {
  const t = await start();
  try {
    const cookie = await t.login();
    t.setNext({ ok: false, error: { code: 'unauthenticated', message: 'Chưa đăng nhập.' }, readFailed: true });
    assert.equal((await t.rpc(cookie)).status, 401);
    t.setNext(null);
    assert.equal((await t.rpc(cookie)).status, 401, 'phiên đã bị thu hồi');
    const fresh = await t.login();
    t.db.prepare("UPDATE users SET active=0 WHERE id='u1'").run();
    assert.equal((await fetch(`${t.origin}/api/events`, { headers: { cookie: fresh } })).status, 401);
  } finally { await t.server.stop(); }
});
