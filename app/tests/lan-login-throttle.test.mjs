// Giới hạn đăng nhập sai qua LAN: khoá theo cặp máy + tài khoản và theo máy,
// đếm lượt ngay khi bắt đầu để loạt yêu cầu song song không lọt qua.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { trustedTestTls } from './helpers/lan-tls.mjs';
const require = createRequire(import.meta.url);
const { LanHttpServer } = require('../../app-dist/main/lan/http-server.js');
const { LoginThrottle } = require('../../app-dist/main/lan/login-throttle.js');

const options = { maxPerPair: 3, maxPerIp: 5, windowMs: 60_000, lockMs: 60_000 };

// 1) Đồng hồ giả: khoá sau đủ số lần sai, tự mở khi hết thời gian khoá, và
// đăng nhập đúng xoá bộ đếm của cặp máy + tài khoản.
{
  let now = 0;
  const throttle = new LoginThrottle(options, () => now);
  for (let i = 0; i < 3; i++) assert.ok('attempt' in throttle.begin('10.0.0.2', 'ktv'), `lần ${i + 1} chưa bị khoá`);
  const locked = throttle.begin('10.0.0.2', 'KTV ');
  assert.ok('retryAfterMs' in locked, 'tên đăng nhập khác hoa/thường hoặc thừa khoảng trắng vẫn chung một khoá');
  assert.equal(locked.retryAfterMs, 60_000);
  assert.ok('attempt' in throttle.begin('10.0.0.3', 'ktv'), 'máy khác không bị khoá theo tài khoản ktv');
  now = 60_001;
  assert.ok('attempt' in throttle.begin('10.0.0.2', 'ktv'), 'hết thời gian khoá thì được thử lại');

  const fresh = new LoginThrottle(options, () => now);
  fresh.begin('10.0.0.4', 'ktv'); fresh.begin('10.0.0.4', 'ktv');
  const ok = fresh.begin('10.0.0.4', 'ktv');
  ok.attempt.succeed();
  assert.ok('attempt' in fresh.begin('10.0.0.4', 'ktv'), 'đăng nhập đúng ở lượt chạm ngưỡng thì gỡ khoá');
}

// 2) Một máy dò nhiều tài khoản bị chặn theo ngưỡng của máy.
{
  const throttle = new LoginThrottle(options, () => 0);
  for (let i = 0; i < 5; i++) assert.ok('attempt' in throttle.begin('10.0.0.9', `u${i}`));
  assert.ok('retryAfterMs' in throttle.begin('10.0.0.9', 'u-moi'), 'quá ngưỡng của máy thì mọi tài khoản đều bị chặn');
}

// 3) Qua HTTP thật: trả 429 kèm Retry-After, và loạt yêu cầu song song chỉ
// có đúng `maxPerPair` lượt được băm mật khẩu.
const user = { id: 'u1', username: 'ktv', name: 'KTV', role: 'technician', active: true };
let loginCalls = 0;
const server = new LanHttpServer({
  login: async (input) => {
    loginCalls++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return input.data?.password === 'secret' ? { ok: true, data: user } : { ok: false, error: { code: 'invalid-credentials', message: 'Sai.' } };
  },
  actorOf: (row) => ({ userId: row.id, username: row.username, name: row.name, role: row.role, clientId: 'lan-web' }),
  currentUser: () => user,
  invoke: async () => ({ ok: true }),
  tls: trustedTestTls().source,
}, options);
const port = await server.start(0, '127.0.0.1');
const origin = `https://127.0.0.1:${port}`;
const attempt = (username, password) => fetch(`${origin}/api/auth/login`, { method: 'POST', body: JSON.stringify({ data: { username, password } }) });

const ok = await attempt('ktv', 'secret');
assert.equal(ok.status, 200, 'đăng nhập đúng không bị ảnh hưởng');

const burst = await Promise.all(Array.from({ length: 8 }, () => attempt('ktv', 'sai')));
const statuses = burst.map((response) => response.status).sort();
assert.deepEqual(statuses, [401, 401, 401, 429, 429, 429, 429, 429], 'chỉ 3 lượt sai được xử lý, số còn lại bị chặn trước khi băm');
assert.equal(loginCalls, 4, 'yêu cầu bị chặn không được gọi tới bước kiểm mật khẩu');

const blocked = await attempt('ktv', 'secret');
assert.equal(blocked.status, 429, 'đang bị khoá thì kể cả đúng mật khẩu cũng phải chờ');
assert.ok(Number(blocked.headers.get('retry-after')) > 0);
const body = await blocked.json();
assert.equal(body.ok, false);
assert.equal(body.error.code, 'too-many-attempts');
assert.match(body.error.message, /Thử lại sau 1 phút/);

await server.stop();
console.log('app LAN login throttle tests passed');
