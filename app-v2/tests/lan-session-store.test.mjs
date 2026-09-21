import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LanSessionStore } = require('../../app-v2-dist/main/lan/session-store.js');

let clock = 1000;
const store = new LanSessionStore(100, () => clock);
const actor = { userId: 'u1', username: 'ktv', name: 'KTV', role: 'user', clientId: 'lan:test' };
const session = store.create(actor);
assert.match(session.token, /^[A-Za-z0-9_-]{40,}$/);
assert.equal(store.get(session.token)?.actor.username, 'ktv');
clock += 101;
assert.equal(store.get(session.token), null, 'phiên hết hạn không được tái sử dụng');
const next = store.create(actor);
store.revoke(next.token);
assert.equal(store.get(next.token), null, 'đăng xuất phải thu hồi phiên ngay');
console.log('app-v2 LAN session store tests passed');
