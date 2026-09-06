// Giai đoạn C3: xuất/phục hồi toàn bộ dữ liệu app-v2. Kiểm chứng END-TO-END
// thật: tạo dữ liệu qua các handler đã có → export → phục hồi vào 1 DB
// KHÁC (mô phỏng máy khác/cài lại) → đối chiếu dữ liệu khớp lại đúng, cộng
// các điều kiện chặn phục hồi khi backup hỏng.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createBackupHandlers } = require('../../app-v2-dist/main/ipc/backup-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };
const viewer = { ...actor, role: 'viewer' };

// DB nguon: tao vai du lieu that
const sourceDb = openDatabase(':memory:');
const sourceConfig = createConfigHandlers(sourceDb);
const sourceBackup = createBackupHandlers(sourceDb, os.tmpdir());
const instrument = sourceConfig.saveInstrument({ data: { name: 'May A' } }, actor).data;
const test1 = sourceConfig.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
sourceConfig.saveTestLevel({ testId: test1.id, data: { level: 1, mean: 5, sd: 0.2 } }, actor);

// 1) Chi admin moi duoc phuc hoi
const exported = sourceBackup.exportBackup(actor);
assert.equal(exported.ok, true);
const targetDbForbidden = openDatabase(':memory:');
const targetBackupForbidden = createBackupHandlers(targetDbForbidden, os.tmpdir());
const forbidden = targetBackupForbidden.importBackup({ data: { json: exported.data } }, viewer);
assert.equal(forbidden.ok, false);
assert.equal(forbidden.error.code, 'forbidden');

// 2) Phuc hoi vao 1 DB KHAC (mo phong may khac) - du lieu phai khop lai dung
const targetDb = openDatabase(':memory:');
const targetBackup = createBackupHandlers(targetDb, os.tmpdir());
const restored = targetBackup.importBackup({ data: { json: exported.data } }, actor);
assert.equal(restored.ok, true, JSON.stringify(restored));
assert.ok(restored.data.preRestoreSnapshotPath.startsWith(path.normalize(os.tmpdir())) || restored.data.preRestoreSnapshotPath.includes('pre-restore-backup-'));

const targetConfig = createConfigHandlers(targetDb);
const restoredInstruments = targetConfig.listInstruments();
assert.equal(restoredInstruments.length, 1);
assert.equal(restoredInstruments[0].name, 'May A');
const restoredTests = targetConfig.listTests();
assert.equal(restoredTests.length, 1);
assert.equal(restoredTests[0].name, 'Glucose');
const restoredLevels = targetConfig.listTestLevels(test1.id);
assert.equal(restoredLevels.length, 1);
assert.equal(restoredLevels[0].mean, 5);

// 3) Checksum bi sua phai bi chan
const tampered = JSON.parse(exported.data);
tampered.data.instruments[0].name = 'Bi sua doi';
const tamperedTarget = createBackupHandlers(openDatabase(':memory:'), os.tmpdir());
const tamperedResult = tamperedTarget.importBackup({ data: { json: JSON.stringify(tampered) } }, actor);
assert.equal(tamperedResult.ok, false);
assert.equal(tamperedResult.error.code, 'checksum-mismatch');

// 4) format sai (khong phai backup app-v2) phai bi chan voi thong bao ro
const wrongFormatTarget = createBackupHandlers(openDatabase(':memory:'), os.tmpdir());
const wrongFormat = wrongFormatTarget.importBackup({ data: { json: JSON.stringify({ format: 'qclab-backup', schemaVersion: 1, data: {}, checksum: 'x' }) } }, actor);
assert.equal(wrongFormat.ok, false);
assert.equal(wrongFormat.error.code, 'wrong-format');

// 5) schemaVersion cao hon hien tai phai bi chan
const { SCHEMA_VERSION } = require('../../app-v2-dist/main/db/schema.js');
const futureSchema = JSON.parse(exported.data);
futureSchema.schemaVersion = SCHEMA_VERSION + 1;
futureSchema.checksum = require('../../app-v2-dist/main/domain/backup.js').computeChecksum(JSON.stringify(futureSchema.data));
const futureTarget = createBackupHandlers(openDatabase(':memory:'), os.tmpdir());
const futureResult = futureTarget.importBackup({ data: { json: JSON.stringify(futureSchema) } }, actor);
assert.equal(futureResult.ok, false);
assert.equal(futureResult.error.code, 'unsupported-schema');

// 6) JSON hong hoan toan phai bao loi ro, khong crash
const brokenTarget = createBackupHandlers(openDatabase(':memory:'), os.tmpdir());
const broken = brokenTarget.importBackup({ data: { json: 'khong-phai-json{' } }, actor);
assert.equal(broken.ok, false);
assert.equal(broken.error.code, 'invalid-json');

// ── Giai doan D3.3: kiem tra backup (chi doc) + xoa sach du lieu ─────────

// 7) verifyBackup: chi doc file, KHONG doi gi trong DB dang dung
const verifyDb = openDatabase(':memory:');
const verifyConfig = createConfigHandlers(verifyDb);
const verifyBackupHandlers = createBackupHandlers(verifyDb, os.tmpdir());
verifyConfig.saveInstrument({ data: { name: 'May giu nguyen' } }, actor);
const instrumentsBefore = verifyConfig.listInstruments().length;
const verified = verifyBackupHandlers.verifyBackup({ data: { json: exported.data } }, actor);
assert.equal(verified.ok, true);
assert.ok(verified.data.tables > 0, 'phai dem duoc so bang');
assert.ok(verified.data.rows > 0, 'phai dem duoc so dong');
assert.equal(verifyConfig.listInstruments().length, instrumentsBefore, 'kiem tra backup KHONG duoc doi du lieu dang dung');
// Checksum sai bi phat hien
const tamperedEnvelope = JSON.parse(exported.data);
tamperedEnvelope.data.instruments = [];
const tamperedVerify = verifyBackupHandlers.verifyBackup({ data: { json: JSON.stringify(tamperedEnvelope) } }, actor);
assert.equal(tamperedVerify.ok, false);
assert.equal(tamperedVerify.error.code, 'checksum-mismatch');
// Chi admin
assert.equal(verifyBackupHandlers.verifyBackup({ data: { json: exported.data } }, viewer).error.code, 'forbidden');

// 8) resetOperationalData: xoa du lieu van hanh, GIU tai khoan + nhat ky
const resetDb = openDatabase(':memory:');
const resetConfig = createConfigHandlers(resetDb);
const resetBackup = createBackupHandlers(resetDb, os.tmpdir());
const { createAuthHandlers } = require('../../app-v2-dist/main/ipc/auth-handlers.js');
const { verifyAuditChain } = require('../../app-v2-dist/main/domain/audit-chain.js');
const resetAuth = createAuthHandlers(resetDb);
resetAuth.bootstrapAdmin({ data: { username: 'admin', name: 'Quan tri', password: 'mat-khau-dai-1' } });
const resetActor = { ...actor, userId: resetAuth.listUsers(actor).data[0].id, username: 'admin' };
const resetInstrument = resetConfig.saveInstrument({ data: { name: 'May se bi xoa' } }, resetActor).data;
resetConfig.saveTest({ data: { name: 'Test se bi xoa', instrumentId: resetInstrument.id } }, resetActor);
const usersBefore = resetAuth.listUsers(resetActor).data.length;
const activityBefore = resetConfig.listActivity(1000).length;
assert.ok(activityBefore > 0);

assert.equal(resetBackup.resetOperationalData(viewer).error.code, 'forbidden', 'chi admin duoc xoa sach');
const reset = resetBackup.resetOperationalData(resetActor);
assert.equal(reset.ok, true);
assert.ok(reset.data.clearedTables.includes('instruments') && reset.data.clearedTables.includes('qc_points'), 'phai xoa bang du lieu van hanh');
assert.ok(!reset.data.clearedTables.includes('users') && !reset.data.clearedTables.includes('activity'), 'KHONG duoc xoa users/activity');
assert.equal(resetConfig.listInstruments().length, 0, 'du lieu van hanh phai sach');
assert.equal(resetAuth.listUsers(resetActor).data.length, usersBefore, 'tai khoan phai con nguyen');
// Nhat ky con nguyen + them dung 1 dong cho chinh thao tac xoa, va chuoi
// hash van xac minh duoc (day la ly do phai GIU ca activity lan app_meta)
const activityAfter = resetConfig.listActivity(1000);
assert.equal(activityAfter.length, activityBefore + 1, 'giu nhat ky cu + ghi them 1 dong xoa sach');
assert.equal(activityAfter[0].type, 'Xoá sạch dữ liệu');
const chain = verifyAuditChain(activityAfter.slice().reverse(), '');
assert.equal(chain.ok, true, 'chuoi hash audit phai con hop le sau khi xoa sach: ' + JSON.stringify(chain));
// Ho so don vi tro ve mac dinh cua schema (khop blankAppState() app cu)
const { createSettingsHandlers } = require('../../app-v2-dist/main/ipc/settings-handlers.js');
const resetSettings = createSettingsHandlers(resetDb, ':memory:');
assert.equal(resetSettings.getLabProfile().name, '', 'ten don vi tro ve rong');
assert.equal(resetSettings.getLabProfile().brand_title, 'QC Lab', 'thuong hieu tro ve mac dinh');

console.log('app-v2 backup-handlers end-to-end tests passed');
