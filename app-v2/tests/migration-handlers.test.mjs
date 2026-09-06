// Giai đoạn C4: kiểm chứng END-TO-END migration-handlers.ts — preview không
// ghi DB, import ghi thật + xoá sạch dữ liệu app-v2 cũ (nếu có) + tạo bản
// an toàn trước khi ghi đè + chỉ admin + mật khẩu cũ đăng nhập được ngay
// (cùng thuật toán/định dạng PBKDF2) + chuỗi audit tiếp nối đúng.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createMigrationHandlers } = require('../../app-v2-dist/main/ipc/migration-handlers.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createAuthHandlers } = require('../../app-v2-dist/main/ipc/auth-handlers.js');
const { hashPassword } = require('../../app-v2-dist/main/domain/password-hash.js');
const { verifyAuditChain, auditEntryHash } = require('../../app-v2-dist/main/domain/audit-chain.js');

function buildLegacyEnvelope(legacyState) {
  const dataJson = JSON.stringify(legacyState);
  const checksum = createHash('sha256').update(dataJson, 'utf8').digest('hex');
  return JSON.stringify({ format: 'qclab-backup', formatVersion: 1, type: 'full', createdAt: new Date().toISOString(), appVersion: '1.0.0', schemaVersion: 6, checksum, data: legacyState });
}

const legacyPassHash = hashPassword('mat-khau-cu-123');
const legacyActivity = [];
function pushActivity(a) {
  const prevHash = legacyActivity.length ? legacyActivity[legacyActivity.length - 1].hash : '';
  const entry = { ...a, prevHash, hash: '' };
  entry.hash = auditEntryHash(entry);
  legacyActivity.push(entry);
}
// clientId luon la 1 key that trong export backup THAT cua app cu — xem chu
// thich tuong tu o migrate-legacy.test.mjs.
pushActivity({ id: 'act1', seq: 1, ts: '2026-01-01T00:00:00.000Z', user: 'Quan tri vien cu', username: 'admin_cu', userId: 'u1', role: 'admin', type: 'Dang nhap', detail: '', target: 'admin_cu', clientId: '' });

const legacyState = {
  schemaVersion: 6,
  lab: { name: 'PXN Di Tru', dept: '', address: '' },
  instruments: [{ id: 'ins1', name: 'May Cu A', active: true }],
  tests: [{ id: 't1', name: 'Glucose Cu', instrumentId: 'ins1', unit: 'mg/dL', decimalPlaces: 1, active: true, levels: [{ level: 1, mean: 100, sd: 2 }] }],
  data: { t1: [{ id: 'p1', date: '2026-01-05', runId: 'r1', level: 1, val: 101, operatorId: 'u1', operatorUsername: 'admin_cu', voided: false }] },
  users: [{ id: 'u1', username: 'admin_cu', name: 'Quan tri vien cu', role: 'admin', passHash: legacyPassHash, active: true, avatar: 'data:image/png;base64,iVBORw0KGgo=' }],
  activity: legacyActivity,
  activityAnchor: '',
};
const legacyJson = buildLegacyEnvelope(legacyState);
const actor = { userId: 'u1', username: 'admin_cu', name: 'Quan tri vien cu', role: 'admin', clientId: 'test-client' };
const viewer = { ...actor, role: 'viewer' };

// 1) preview KHONG ghi DB - goi 2 lan tren cung 1 DB rong phai cho cung ket qua
const db = openDatabase(':memory:');
const migration = createMigrationHandlers(db, os.tmpdir());
const preview1 = migration.preview({ data: { json: legacyJson } });
assert.equal(preview1.ok, true, JSON.stringify(preview1));
assert.equal(preview1.data.tests, 1);
assert.equal(preview1.data.qcPoints, 1);
const configBeforeImport = createConfigHandlers(db);
assert.equal(configBeforeImport.listInstruments().length, 0, 'preview khong duoc ghi du lieu vao DB');

// 2) chi admin duoc import
const forbidden = migration.importLegacy({ data: { json: legacyJson } }, viewer);
assert.equal(forbidden.ok, false);
assert.equal(forbidden.error.code, 'forbidden');

// 3) import that: ghi du lieu + tao ban an toan + audit lien tuc
const imported = migration.importLegacy({ data: { json: legacyJson } }, actor);
assert.equal(imported.ok, true, JSON.stringify(imported));
assert.ok(fs.existsSync(imported.data.preMigrationSnapshotPath), 'phai co file an toan that tren dia');
fs.rmSync(imported.data.preMigrationSnapshotPath, { force: true });

const config = createConfigHandlers(db);
const instruments = config.listInstruments();
assert.equal(instruments.length, 1);
assert.equal(instruments[0].name, 'May Cu A');
const tests = config.listTests();
assert.equal(tests.length, 1);
assert.equal(tests[0].name, 'Glucose Cu');
const points = db.prepare('SELECT * FROM qc_points').all();
assert.equal(points.length, 1);
assert.equal(points[0].val, 101);

// 4) mat khau cu dang nhap duoc NGAY (cung PBKDF2 + cung dinh dang chuoi)
const auth = createAuthHandlers(db);
const login = auth.login({ data: { username: 'admin_cu', password: 'mat-khau-cu-123' } });
assert.equal(login.ok, true, JSON.stringify(login));
assert.equal(login.data.username, 'admin_cu');
// Cot avatar MOI THEM (2026-09-04) tung lam vo di tru: cot NOT NULL nhung
// restoreAllTables() bind null cho field khong co trong ban do — phai anh xa
// dung trong migrate-legacy.ts, khong chi dua vao DEFAULT ''.
assert.equal(login.data.avatar, 'data:image/png;base64,iVBORw0KGgo=', 'anh dai dien phai di tru dung, khong roi ve rong');

// 5) chuoi audit noi tiep dung: dong dang nhap vua roi (do login() tu ghi)
// phai chain dung tren dong activity da di tru, khong dut doan
const activityRows = db.prepare('SELECT * FROM activity ORDER BY seq ASC').all();
assert.ok(activityRows.length >= 3, 'phai co: dong da di tru + dong "di tru du lieu" + dong dang nhap vua roi');
const chainCheck = verifyAuditChain(activityRows.map(a => ({
  id: a.id, seq: a.seq, ts: a.ts, user: a.user, username: a.username, userId: a.user_id,
  role: a.role, type: a.type, detail: a.detail, target: a.target, clientId: a.client_id,
  prevHash: a.prev_hash, hash: a.hash,
})), '');
assert.equal(chainCheck.ok, true, JSON.stringify(chainCheck));
assert.equal(activityRows[0].id, 'act1', 'dong hoat dong cu nhat phai la dong da di tru tu app cu, khong bi xoa');

// 6) format sai (backup app-v2 that su, khong phai app cu) phai bi tu choi ro rang
const wrongFormatResult = migration.preview({ data: { json: JSON.stringify({ format: 'qclab-v2-backup', data: {} }) } });
assert.equal(wrongFormatResult.ok, false);
assert.equal(wrongFormatResult.error.code, 'wrong-format');

// 7) JSON hong hoan toan khong crash
const brokenResult = migration.importLegacy({ data: { json: 'khong-phai-json{' } }, actor);
assert.equal(brokenResult.ok, false);
assert.equal(brokenResult.error.code, 'invalid-json');

console.log('app-v2 migration-handlers end-to-end tests passed');
