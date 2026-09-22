// End-to-end Firebase Settings: dùng client REST giả để chốt luồng SQLite →
// backup checksum → RTDB, không cần tài khoản Firebase/thông tin bí mật.
import assert from 'node:assert/strict';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createFirebaseHandlers } = require('../../app-dist/main/ipc/firebase-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const configText = JSON.stringify({ apiKey: 'test-key', authDomain: 'test.firebaseapp.com', databaseURL: 'https://test-default-rtdb.firebaseio.com', projectId: 'test', appId: '1:test:web:x' });

let remote = null;
const fakeClient = {
  async signIn(_config, email, password) { if (password !== 'secret') throw new Error('INVALID_PASSWORD'); return { idToken: 'token', uid: `uid-${email}` }; },
  async read() { return remote; },
  async write(_config, _code, _token, value) { remote = value; },
};

// 1) Máy có dữ liệu + Firebase trống: kết nối đẩy dữ liệu lên, không lưu password.
const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const instrument = config.saveInstrument({ data: { name: 'Máy Firebase' } }, actor);
assert.equal(instrument.ok, true);
const firebase = createFirebaseHandlers(db, os.tmpdir(), fakeClient);
const connected = await firebase.connect({ data: { labCode: 'khoaXN', email: 'qc@example.test', password: 'secret', config: configText } }, actor);
assert.equal(connected.ok, true);
assert.equal(connected.data.state, 'pushed');
assert.equal(remote._format, 'qclab-v2-firebase');
assert.equal(remote.backup.data.instruments[0].name, 'Máy Firebase');
assert.equal(firebase.settings().connected, true);
assert.equal(firebase.settings().email, 'qc@example.test');
assert.equal(firebase.settings().config.includes('test-key'), true);
assert.equal(db.prepare("SELECT value FROM app_meta WHERE key='firebasePassword'").get(), undefined, 'mat khau tuyet doi khong duoc luu');

// 2) Hai phía cùng có dữ liệu khác nhau: không được tự ghi đè, bắt chọn hướng.
const conflictDb = openDatabase(':memory:');
createConfigHandlers(conflictDb).saveInstrument({ data: { name: 'Dữ liệu cục bộ khác' } }, actor);
const conflict = createFirebaseHandlers(conflictDb, os.tmpdir(), fakeClient);
const conflictResult = await conflict.connect({ data: { labCode: 'khoaXN', email: 'qc@example.test', password: 'secret', config: configText } }, actor);
assert.equal(conflictResult.ok, true);
assert.equal(conflictResult.data.state, 'conflict');
assert.equal(createConfigHandlers(conflictDb).listInstruments()[0].name, 'Dữ liệu cục bộ khác', 'khong tu ghi de khi conflict');

// 3) Đẩy có audit và thay snapshot trên cloud.
const pushed = await conflict.sync({ data: { direction: 'push' } }, actor);
assert.equal(pushed.ok, true);
assert.equal(remote.backup.data.instruments[0].name, 'Dữ liệu cục bộ khác');
assert.ok(remote.backup.data.activity.some((row) => row.type === 'Đẩy dữ liệu lên Firebase'));

// 4) Máy trống kết nối cloud có sẵn sẽ tải được dữ liệu có checksum hợp lệ.
const emptyDb = openDatabase(':memory:');
const puller = createFirebaseHandlers(emptyDb, os.tmpdir(), fakeClient);
const pulled = await puller.connect({ data: { labCode: 'khoaXN', email: 'qc@example.test', password: 'secret', config: configText } }, actor);
assert.equal(pulled.ok, true);
assert.equal(createConfigHandlers(emptyDb).listInstruments()[0].name, 'Dữ liệu cục bộ khác');

// 5) Kiểm tra đầu vào và phân quyền ở main, không dựa vào renderer.
const viewer = { ...actor, role: 'viewer' };
assert.equal((await puller.connect({ data: { labCode: 'x', email: 'x@y.z', password: 'secret', config: configText } }, viewer)).error.code, 'forbidden');
const invalid = await puller.connect({ data: { labCode: '../bad', email: 'qc@example.test', password: 'secret', config: configText } }, actor);
assert.equal(invalid.ok, false);
assert.match(invalid.error.message, /Mã phòng/);

console.log('app firebase-handlers end-to-end tests passed');
