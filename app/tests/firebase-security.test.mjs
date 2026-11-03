// GV6 (2026-11-03): sao lưu Firebase an toàn.
// - Gói đẩy lên không mang khoá riêng của máy (token LIS, kết nối Firebase).
// - Kéo về giữ nguyên tài khoản của máy; tài khoản chỉ có trên đám mây vào ở
//   trạng thái khoá. Khoá riêng của máy không bị bản đám mây ghi đè.
// - idToken được làm mới bằng refresh token (lưu ngoài CSDL), nên sao lưu tự
//   động không hỏng sau 1 giờ và chạy tiếp sau khi mở lại app.
import assert from 'node:assert/strict';
import os from 'node:os';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createFirebaseHandlers } = require('../../app-dist/main/ipc/firebase-handlers.js');
const { FirebaseSessionExpiredError } = require('../../app-dist/main/domain/firebase-client.js');
const { cloudBackupData, mergeUsersForPull } = require('../../app-dist/main/domain/cloud-backup.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const configText = JSON.stringify({ apiKey: 'k', authDomain: 't.firebaseapp.com', databaseURL: 'https://t-default-rtdb.firebaseio.com', projectId: 't', appId: '1:t:web:x' });
const connectInput = { data: { labCode: 'khoaXN', email: 'qc@example.test', password: 'secret', config: configText } };
const HOUR = 3600_000;

function fakeCloud({ expiresIn = HOUR, refreshFails = false } = {}) {
  const cloud = { remote: null, tokensUsed: [], refreshCalls: 0 };
  cloud.client = {
    async signIn() { return { idToken: 'id-1', refreshToken: 'refresh-1', uid: 'uid', expiresAt: Date.now() + expiresIn }; },
    async refresh(_config, refreshToken) {
      cloud.refreshCalls += 1;
      if (refreshFails) throw new FirebaseSessionExpiredError('TOKEN_EXPIRED');
      return { idToken: `id-${cloud.refreshCalls + 1}`, refreshToken: `${refreshToken}+`, uid: 'uid', expiresAt: Date.now() + HOUR };
    },
    async read(_config, _code, token) { cloud.tokensUsed.push(token); return cloud.remote; },
    async writeJson(_config, _code, token, json) { cloud.tokensUsed.push(token); cloud.remote = JSON.parse(json); },
    uploadUrl: (_config, code, token) => `https://t/${code}.json?auth=${token}`,
  };
  return cloud;
}
const memoryStore = () => { let value = null; return { read: () => value, write: (v) => { value = v; }, get value() { return value; } }; };
const setMeta = (db, key, value) => db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
const metaOf = (db, key) => db.prepare('SELECT value FROM app_meta WHERE key=?').get(key)?.value;
const addUser = (db, id, username, hash) => db.prepare("INSERT INTO users(id,username,name,role,pass_hash,active) VALUES (?,?,?,'admin',?,1)").run(id, username, username, hash);

test('quy tắc thuần: gói đám mây bỏ khoá riêng của máy; gộp tài khoản khi kéo về', () => {
  const data = { app_meta: [{ key: 'lisGatewaySettings', value: '{"token":"x"}' }, { key: 'firebaseConfig', value: '{}' }, { key: 'westgardRules', value: '{}' }], users: [] };
  assert.deepEqual(cloudBackupData(data).app_meta.map((row) => row.key), ['westgardRules']);

  const remote = [{ id: 'a', username: 'Admin', pass_hash: 'remote', active: 1 }, { id: 'b', username: 'ktv2', pass_hash: 'h2', active: 1 }];
  assert.deepEqual(mergeUsersForPull([], remote).users, remote, 'máy chưa có tài khoản: nhận nguyên danh sách');
  const merged = mergeUsersForPull([{ id: 'x', username: 'admin', pass_hash: 'local', active: 1 }], remote);
  assert.deepEqual(merged.users.map((u) => [u.username, u.pass_hash, u.active]), [['admin', 'local', 1], ['ktv2', 'h2', 0]], 'trùng tên đăng nhập (không phân biệt hoa thường) thì giữ bản của máy');
  assert.deepEqual(merged.addedLocked, ['ktv2']);
});

test('đẩy lên không mang token LIS và kết nối Firebase', async () => {
  const db = openDatabase(':memory:');
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy A' } }, actor);
  setMeta(db, 'lisGatewaySettings', JSON.stringify({ url: 'http://lis', token: 'LIS-SECRET' }));
  const cloud = fakeCloud();
  const firebase = createFirebaseHandlers(db, os.tmpdir(), cloud.client);
  assert.equal((await firebase.connect(connectInput, actor)).data.state, 'pushed');
  const keys = cloud.remote.backup.data.app_meta.map((row) => row.key);
  for (const key of ['lisGatewaySettings', 'firebaseConfig', 'firebaseEmail', 'firebaseLabCode', 'firebaseLastStatus']) assert.equal(keys.includes(key), false, key);
  assert.doesNotMatch(JSON.stringify(cloud.remote), /LIS-SECRET/);
});

test('kéo về: giữ tài khoản và cấu hình LIS của máy, tài khoản mới vào ở trạng thái khoá', async () => {
  const cloud = fakeCloud();
  const source = openDatabase(':memory:');
  createConfigHandlers(source).saveInstrument({ data: { name: 'Máy nguồn' } }, actor);
  addUser(source, 'u-admin', 'admin', 'hash-nguon');
  addUser(source, 'u-ktv', 'ktv2', 'hash-ktv');
  await createFirebaseHandlers(source, os.tmpdir(), cloud.client).connect(connectInput, actor);

  const target = openDatabase(':memory:');
  createConfigHandlers(target).saveInstrument({ data: { name: 'Máy đích' } }, actor);
  addUser(target, 'u-local', 'admin', 'hash-may');
  setMeta(target, 'lisGatewaySettings', JSON.stringify({ url: 'http://lis-local', token: 'LOCAL-LIS' }));
  const firebase = createFirebaseHandlers(target, os.tmpdir(), cloud.client);
  assert.equal((await firebase.connect(connectInput, actor)).data.state, 'conflict');
  const pulled = await firebase.sync({ data: { direction: 'pull' } }, actor);
  assert.equal(pulled.ok, true, JSON.stringify(pulled));

  assert.equal(createConfigHandlers(target).listInstruments()[0].name, 'Máy nguồn', 'dữ liệu vận hành lấy từ đám mây');
  const users = target.prepare('SELECT username, pass_hash, active FROM users ORDER BY username').all().map((u) => ({ ...u }));
  assert.deepEqual(users, [{ username: 'admin', pass_hash: 'hash-may', active: 1 }, { username: 'ktv2', pass_hash: 'hash-ktv', active: 0 }]);
  assert.match(metaOf(target, 'lisGatewaySettings'), /LOCAL-LIS/);
  assert.match(metaOf(target, 'firebaseLabCode'), /khoaXN/);
  const audit = target.prepare("SELECT detail FROM activity WHERE type='Tải dữ liệu từ Firebase'").get().detail;
  assert.match(audit, /giữ nguyên 1 tài khoản của máy, thêm 1 tài khoản từ đám mây ở trạng thái khoá \(ktv2\)/);
});

test('token sắp hết hạn được làm mới trước khi đẩy; refresh token lưu ngoài CSDL', async () => {
  const db = openDatabase(':memory:');
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy A' } }, actor);
  const cloud = fakeCloud({ expiresIn: 60_000 });
  const store = memoryStore();
  const firebase = createFirebaseHandlers(db, os.tmpdir(), cloud.client, { secretStore: store });
  await firebase.connect(connectInput, actor);
  assert.equal(cloud.refreshCalls, 1, 'token chỉ còn 1 phút: làm mới trước khi dùng');
  assert.deepEqual(cloud.tokensUsed, ['id-2', 'id-2']);
  assert.equal(JSON.parse(store.value).refreshToken, 'refresh-1+', 'lưu refresh token mới nhất');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM app_meta WHERE value LIKE '%refresh-1%'").get().n, 0, 'không lưu vào CSDL');
});

test('mở lại app: tiếp tục sao lưu tự động bằng refresh token đã lưu', async () => {
  const db = openDatabase(':memory:');
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy A' } }, actor);
  const store = memoryStore();
  await createFirebaseHandlers(db, os.tmpdir(), fakeCloud().client, { secretStore: store }).connect(connectInput, actor);

  const cloud = fakeCloud();
  const reopened = createFirebaseHandlers(db, os.tmpdir(), cloud.client, { secretStore: store });
  assert.equal(reopened.settings().connected, true);
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy B' } }, actor);
  reopened.onDataChanged();
  await reopened.flushPending();
  assert.equal(cloud.refreshCalls, 1);
  assert.ok(cloud.remote.backup.data.instruments.some((row) => row.name === 'Máy B'));
});

test('phiên không làm mới được: quên phiên, báo cần kết nối lại', async () => {
  const db = openDatabase(':memory:');
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy A' } }, actor);
  const store = memoryStore();
  store.write(JSON.stringify({ refreshToken: 'revoked', uid: 'uid' }));
  setMeta(db, 'firebaseConfig', configText);
  setMeta(db, 'firebaseLabCode', 'khoaXN');
  const firebase = createFirebaseHandlers(db, os.tmpdir(), fakeCloud({ refreshFails: true }).client, { secretStore: store });
  const result = await firebase.sync({ data: { direction: 'push' } }, actor);
  assert.equal(result.ok, false);
  assert.match(result.error.message, /hết hạn — cần kết nối lại/);
  assert.equal(firebase.settings().connected, false);
  assert.match(firebase.settings().status, /hết hạn/);
  assert.equal(store.value, null, 'xoá refresh token đã hỏng');
});

test('client: đổi refresh token qua Secure Token API, lỗi 400 là phiên hỏng hẳn', async () => {
  const { createFirebaseClient } = require('../../app-dist/main/domain/firebase-client.js');
  const calls = [];
  const reply = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body) });
  let next = reply(200, { id_token: 'new-id', refresh_token: 'new-refresh', user_id: 'uid', expires_in: '3600' });
  const client = createFirebaseClient(async (url, init) => { calls.push({ url, init }); return next; });
  const config = JSON.parse(configText);
  const session = await client.refresh(config, 'old/refresh');
  assert.equal(calls[0].url, 'https://securetoken.googleapis.com/v1/token?key=k');
  assert.equal(calls[0].init.body, 'grant_type=refresh_token&refresh_token=old%2Frefresh');
  assert.deepEqual([session.idToken, session.refreshToken, session.uid], ['new-id', 'new-refresh', 'uid']);
  assert.ok(session.expiresAt > Date.now() + 3500_000);

  next = reply(400, { error: { message: 'TOKEN_EXPIRED' } });
  await assert.rejects(client.refresh(config, 'x'), (error) => error instanceof FirebaseSessionExpiredError && /TOKEN_EXPIRED/.test(error.message));
  next = reply(503, { error: { message: 'UNAVAILABLE' } });
  await assert.rejects(client.refresh(config, 'x'), (error) => !(error instanceof FirebaseSessionExpiredError), 'lỗi máy chủ: thử lại sau, không quên phiên');
});
