import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LanHttpServer } = require('../../app-dist/main/lan/http-server.js');
const user = { id: 'u1', username: 'ktv', name: 'KTV', role: 'user', active: true };
const server = new LanHttpServer({
  login: (input) => input.password === 'secret' ? { ok: true, data: user } : { ok: false, error: { code: 'bad-login', message: 'Sai mật khẩu.' } },
  getLoginBrand: () => ({ brand_title: 'QC Lab', brand_sub: 'Nội kiểm xét nghiệm', logo_text: 'QC', logo_data: 'data:image/png;base64,abc' }),
  actorOf: (row) => ({ userId: row.id, username: row.username, name: row.name, role: row.role, clientId: 'lan-web' }),
  currentUser: () => user,
  invoke: async (method, args, actor) => ({ ok: true, data: { method, args, user: actor.username } }),
});
const port = await server.start(0, '127.0.0.1'); const origin = `http://127.0.0.1:${port}`;
assert.equal((await fetch(`${origin}/api/health`)).status, 200);
assert.deepEqual(await (await fetch(`${origin}/api/brand`)).json(), { brand_title: 'QC Lab', brand_sub: 'Nội kiểm xét nghiệm', logo_text: 'QC', logo_data: 'data:image/png;base64,abc' });
assert.equal((await fetch(`${origin}/api/session`)).status, 401);
const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', body: JSON.stringify({ password: 'secret' }) });
assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie'); assert.match(cookie, /HttpOnly/);
const rpc = await fetch(`${origin}/api/rpc`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'entry:addPoint', args: [{ data: { val: 1 } }] }) });
assert.deepEqual((await rpc.json()).data, { method: 'entry:addPoint', args: [{ data: { val: 1 } }], user: 'ktv' });
await server.stop(); console.log('app LAN HTTP server tests passed');

// Nếu cổng LAN ưu tiên đã bị app khác chiếm, lần start lỗi phải giải phóng
// trạng thái nội bộ để main process có thể chuyển sang một cổng trống.
const occupied = new LanHttpServer({ login: () => ({ ok: false, error: { code: 'x', message: 'x' } }), actorOf: () => ({}), currentUser: () => null, invoke: async () => ({ ok: true }) });
const occupiedPort = await occupied.start(0, '127.0.0.1');
const fallback = new LanHttpServer({ login: () => ({ ok: false, error: { code: 'x', message: 'x' } }), actorOf: () => ({}), currentUser: () => null, invoke: async () => ({ ok: true }) });
await assert.rejects(fallback.start(occupiedPort, '127.0.0.1'));
const fallbackPort = await fallback.start(0, '127.0.0.1');
assert.notEqual(fallbackPort, occupiedPort);
await fallback.stop(); await occupied.stop(); console.log('app LAN port fallback tests passed');


