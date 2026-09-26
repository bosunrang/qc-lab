// Firebase chỉ để sao lưu (kế hoạch kiến trúc B): đẩy theo chu kỳ tính từ
// thay đổi đầu tiên (không dời theo từng thao tác), đẩy nốt khi đóng app, đo
// cỡ trước khi gửi, và ngắt kết nối là một đơn vị nguyên tử. Chu kỳ thật là
// 15 phút; test dùng chu kỳ ngắn qua `periodMs`.
import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createFirebaseHandlers, FIREBASE_PUSH_PERIOD_MS } = require('../../app-dist/main/ipc/firebase-handlers.js');
const { writeAudit } = require('../../app-dist/main/ipc/shared.js');
const { buildFirebasePayload, sizeVerdict, FIREBASE_MAX_WRITE_BYTES } = require('../../app-dist/main/sync/firebase-payload.js');
const { validateBackupEnvelope } = require('../../app-dist/main/domain/backup.js');
const { SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const configText = JSON.stringify({ apiKey: 'k', authDomain: 't.firebaseapp.com', databaseURL: 'https://t-default-rtdb.firebaseio.com', projectId: 't', appId: '1:t:web:x' });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fakeClient() {
  const writes = [];
  return {
    writes,
    remote: null,
    async signIn() { return { idToken: 'token', uid: 'uid' }; },
    async read() { return this.remote; },
    async writeJson(_c, _l, _t, json) { writes.push(Date.now()); this.remote = JSON.parse(json); },
    uploadUrl: () => 'https://t-default-rtdb.firebaseio.com/qclab-shared/x.json',
  };
}

async function connected(periodMs, options = {}) {
  const db = openDatabase(':memory:');
  const client = fakeClient();
  const firebase = createFirebaseHandlers(db, os.tmpdir(), client, { periodMs, ...options });
  const result = await firebase.connect({ data: { labCode: 'khoaXN', email: 'qc@example.test', password: 'secret', config: configText } }, actor);
  assert.equal(result.ok, true, JSON.stringify(result));
  client.writes.length = 0;
  return { db, client, firebase, config: createConfigHandlers(db) };
}

test('chu kỳ mặc định là 15 phút', () => {
  assert.equal(FIREBASE_PUSH_PERIOD_MS, 15 * 60 * 1000);
});

test('nhiều thao tác ghi gom thành MỘT lần đẩy, hẹn từ thay đổi đầu tiên', async () => {
  // Chu kỳ 600 ms; thay đổi ở 0, 400 và 500 ms. Đúng: đẩy quanh 600 ms. Nếu
  // lịch bị dời theo thay đổi cuối (debounce) thì sẽ đẩy quanh 1100 ms.
  const { client, firebase, db } = await connected(600);
  const started = Date.now();
  writeAudit(db, actor, 'Thử', 'thay đổi 1', '');
  firebase.onDataChanged();
  assert.match(firebase.settings().status, /Có thay đổi chưa đẩy · tự đẩy lúc/);
  await wait(400);
  firebase.onDataChanged(); // thay đổi mới không dời lịch
  await wait(100);
  firebase.onDataChanged();
  assert.equal(client.writes.length, 0, 'chưa tới chu kỳ thì chưa đẩy');
  for (let i = 0; i < 100 && !client.writes.length; i++) await wait(20);
  assert.equal(client.writes.length, 1, 'đẩy đúng một lần cho cả loạt thay đổi');
  const pushedAfter = client.writes[0] - started;
  assert.ok(pushedAfter >= 580 && pushedAfter < 1000, `đẩy theo mốc thay đổi đầu tiên, không dời theo thay đổi sau (${pushedAfter} ms)`);
  assert.equal(firebase.hasPendingPush(), false);
  assert.doesNotMatch(firebase.settings().status, /chưa đẩy/);
  assert.match(firebase.settings().status, /^Đã đồng bộ .* MB$/);
  await wait(200);
  assert.equal(client.writes.length, 1, 'không có thay đổi mới thì không đẩy lại');
});

test('đóng app: đẩy nốt thay đổi còn chờ ngay, không đợi hết chu kỳ', async () => {
  const { client, firebase } = await connected(60_000);
  firebase.onDataChanged();
  assert.equal(firebase.hasPendingPush(), true);
  await firebase.flushPending();
  assert.equal(client.writes.length, 1);
  assert.equal(firebase.hasPendingPush(), false);
  await firebase.flushPending();
  assert.equal(client.writes.length, 1, 'không còn gì chờ thì không đẩy');
});

test('chưa kết nối thì không hẹn đẩy', () => {
  const db = openDatabase(':memory:');
  const firebase = createFirebaseHandlers(db, os.tmpdir(), fakeClient(), { periodMs: 10 });
  firebase.onDataChanged();
  assert.equal(firebase.hasPendingPush(), false);
});

test('gói vượt giới hạn Firebase: không gửi, báo rõ, giữ thay đổi để thử lại', async () => {
  const tooLarge = 300 * 1024 * 1024;
  let grown = false; // lúc kết nối dữ liệu còn nhỏ; sau đó phình quá giới hạn
  const { firebase } = await connected(60_000, {
    dbPath: 'C:/qclab/qclab.sqlite',
    pushRunner: async () => (grown
      ? { ok: false, code: 'too-large', message: 'quá cỡ', bytes: tooLarge, ratio: tooLarge / FIREBASE_MAX_WRITE_BYTES }
      : { ok: true, bytes: 1024, ts: Date.now(), checksum: 'x', ratio: 0 }),
  });
  grown = true;
  firebase.onDataChanged();
  const pushed = await firebase.sync({ data: { direction: 'push' } }, actor);
  assert.equal(pushed.ok, false);
  assert.match(pushed.error.message, /300\.0 MB vượt giới hạn 256\.0 MB/);
  assert.match(firebase.settings().status, /^Không đẩy lên: gói đồng bộ 300\.0 MB vượt giới hạn/);
  assert.equal(firebase.hasPendingPush(), true, 'thay đổi chưa lên được thì vẫn chờ');
});

test('sau một lần đẩy hỏng, thao tác ghi mới không kích hoạt đẩy lại ngay', async () => {
  let attempts = 0;
  let online = true;
  const { firebase } = await connected(600, {
    dbPath: 'C:/qclab/qclab.sqlite',
    pushRunner: async () => { attempts++; return online ? { ok: true, bytes: 1024, ts: Date.now(), checksum: 'x', ratio: 0 } : { ok: false, code: 'upload-failed', message: 'mất mạng' }; },
  });
  attempts = 0; online = false;
  firebase.onDataChanged();
  const failedAt = Date.now();
  assert.equal((await firebase.sync({ data: { direction: 'push' } }, actor)).ok, false);
  assert.equal(attempts, 1);
  for (let i = 0; i < 5; i++) { firebase.onDataChanged(); await wait(20); }
  assert.equal(attempts, 1, 'không thử lại dồn dập theo từng thao tác ghi');
  online = true;
  for (let i = 0; i < 100 && attempts < 2; i++) await wait(20);
  assert.equal(attempts, 2, 'thử lại đúng một lần sau một chu kỳ');
  assert.ok(Date.now() - failedAt >= 550, 'lần thử lại cách lần hỏng đủ một chu kỳ');
  assert.equal(firebase.hasPendingPush(), false);
});

test('gần giới hạn thì cảnh báo trong trạng thái', async () => {
  const bytes = Math.round(FIREBASE_MAX_WRITE_BYTES * 0.85);
  const { firebase } = await connected(60_000, {
    dbPath: 'C:/qclab/qclab.sqlite',
    pushRunner: async () => ({ ok: true, bytes, ts: Date.now(), checksum: 'x', ratio: bytes / FIREBASE_MAX_WRITE_BYTES }),
  });
  await firebase.sync({ data: { direction: 'push' } }, actor);
  assert.match(firebase.settings().status, /Cảnh báo: đã dùng 85% giới hạn 256\.0 MB/);
  assert.equal(sizeVerdict(FIREBASE_MAX_WRITE_BYTES * 0.5).kind, 'ok');
  assert.equal(sizeVerdict(FIREBASE_MAX_WRITE_BYTES * 0.8).kind, 'warn');
  assert.equal(sizeVerdict(FIREBASE_MAX_WRITE_BYTES + 1).kind, 'too-large');
});

test('gói đẩy lên là backup hợp lệ có checksum', () => {
  const db = openDatabase(':memory:');
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy sao lưu' } }, actor);
  const payload = buildFirebasePayload(db);
  assert.equal(payload._format, 'qclab-firebase');
  assert.equal(validateBackupEnvelope(payload.backup, SCHEMA_VERSION).ok, true);
  assert.equal(payload.backup.data.instruments[0].name, 'Máy sao lưu');
});

test('ngắt kết nối là một đơn vị: ghi nhật ký lỗi thì cấu hình không bị xoá', async () => {
  const { db, firebase } = await connected(60_000);
  const before = db.prepare("SELECT value FROM app_meta WHERE key='firebaseLabCode'").get().value;
  db.exec('DROP TABLE activity');
  assert.throws(() => firebase.disconnect(actor));
  assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='firebaseLabCode'").get().value, before, 'cấu hình giữ nguyên khi ngắt kết nối hỏng giữa chừng');
  assert.equal(firebase.settings().connected, true, 'phiên trong bộ nhớ cũng giữ nguyên');
});
