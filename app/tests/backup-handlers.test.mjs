// Xuất/phục hồi toàn bộ dữ liệu app. Kiểm chứng END-TO-END thật: tạo dữ liệu
// qua các handler đã có → xuất ra tệp backup SQLite → phục hồi vào 1 DB KHÁC
// (mô phỏng máy khác/cài lại) → đối chiếu dữ liệu, cộng các điều kiện chặn
// phục hồi khi tệp hỏng, sai định dạng hoặc từ phiên bản mới hơn. Tệp .json
// xuất trước 2026-09-25 vẫn phải phục hồi được.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { listActivity } from './helpers/activity.mjs';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createBackupHandlers } = require('../../app-dist/main/ipc/backup-handlers.js');
const { SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { dumpAllTables } = require('../../app-dist/main/db/table-io.js');
const { buildBackupEnvelope } = require('../../app-dist/main/domain/backup.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };
const viewer = { ...actor, role: 'viewer' };
const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-backup-test-'));
const file = (name) => path.join(dir, name);

// ── 1) Xuất ra tệp SQLite ────────────────────────────────────────────────
const sourceDb = openDatabase(':memory:');
const sourceConfig = createConfigHandlers(sourceDb);
const sourceBackup = createBackupHandlers(sourceDb, dir);
const instrument = sourceConfig.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
const test1 = sourceConfig.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
sourceConfig.saveTestLevel({ testId: test1.id, data: { level: 1, mean: 5, sd: 0.2 } }, actor);

assert.equal(sourceBackup.exportBackupTo(file('cam.sqlite'), viewer).error.code, 'forbidden', 'chỉ admin được xuất');
assert.equal(existsSync(file('cam.sqlite')), false, 'bị từ chối thì không được tạo tệp');

const backupPath = file('backup.sqlite');
const exported = sourceBackup.exportBackupTo(backupPath, actor);
assert.equal(exported.ok, true, JSON.stringify(exported));
assert.equal(exported.data.path, backupPath);
assert.ok(exported.data.bytes > 0);
assert.equal(readFileSync(backupPath).subarray(0, 16).toString('latin1'), 'SQLite format 3\u0000', 'tệp backup là SQLite');
assert.deepEqual(readdirSync(dir).filter((n) => n.includes('.partial-')), [], 'không để lại tệp tạm');
assert.equal(sourceBackup.backupStatus().lastBackupBytes, exported.data.bytes, 'ghi đúng kích thước tệp vừa xuất');
assert.ok(sourceBackup.backupStatus().lastBackupAt);
// Xuất đè lên tệp đã có (người dùng chọn lại cùng tên trong hộp thoại).
assert.equal(sourceBackup.exportBackupTo(backupPath, actor).ok, true, 'xuất đè tệp cũ được');

// ── 2) Kiểm tra tệp: chỉ đọc, không đổi DB đang dùng ─────────────────────
const verifyDb = openDatabase(':memory:');
const verifyConfig = createConfigHandlers(verifyDb);
const verifyBackup = createBackupHandlers(verifyDb, dir);
verifyConfig.saveInstrument({ data: { name: 'Máy giữ nguyên' } }, actor);
const verified = verifyBackup.verifyBackupFile(backupPath, actor);
assert.equal(verified.ok, true, JSON.stringify(verified));
assert.ok(verified.data.tables > 0 && verified.data.rows > 0, 'đếm được số bảng/số dòng');
assert.equal(verified.data.schemaVersion, SCHEMA_VERSION);
assert.equal(verified.data.legacy, false);
assert.ok(verified.data.createdAt);
assert.deepEqual(verifyConfig.listInstruments().map((i) => i.name), ['Máy giữ nguyên'], 'kiểm tra KHÔNG đổi dữ liệu đang dùng');
assert.equal(verifyBackup.verifyBackupFile(backupPath, viewer).error.code, 'forbidden');

// ── 3) Phục hồi vào DB khác ──────────────────────────────────────────────
const forbidden = createBackupHandlers(openDatabase(':memory:'), dir).importBackupFrom(backupPath, viewer);
assert.equal(forbidden.error.code, 'forbidden');

const targetDb = openDatabase(':memory:');
const targetConfig = createConfigHandlers(targetDb);
targetConfig.saveInstrument({ data: { name: 'Máy sẽ bị thay' } }, actor);
const restored = createBackupHandlers(targetDb, dir).importBackupFrom(backupPath, actor);
assert.equal(restored.ok, true, JSON.stringify(restored));
assert.ok(restored.data.preRestoreSnapshotPath.endsWith('.sqlite'), 'bản an toàn là tệp SQLite');
assert.equal(readFileSync(restored.data.preRestoreSnapshotPath).subarray(0, 15).toString('latin1'), 'SQLite format 3');
const snapshot = new DatabaseSync(restored.data.preRestoreSnapshotPath, { readOnly: true });
assert.deepEqual(snapshot.prepare('SELECT name FROM instruments').all().map((r) => r.name), ['Máy sẽ bị thay'], 'bản an toàn giữ dữ liệu TRƯỚC khi phục hồi');
snapshot.close();
assert.deepEqual(targetConfig.listInstruments().map((i) => i.name), ['Máy A']);
assert.deepEqual(targetConfig.listTests().map((t) => t.name), ['Glucose']);
assert.equal(targetConfig.listTestLevels(test1.id)[0].mean, 5);
assert.equal(targetDb.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='backup_info'").get().n, 0, 'bảng mô tả backup không lọt vào DB đang dùng');

// ── 4) Tệp hỏng / sai định dạng / phiên bản mới hơn ──────────────────────
const target = () => createBackupHandlers(openDatabase(':memory:'), dir);

const corrupted = Buffer.from(readFileSync(backupPath));
for (let i = 4096; i < corrupted.length; i += 97) corrupted[i] ^= 0xff; // làm hỏng các trang dữ liệu, giữ header
writeFileSync(file('hong.sqlite'), corrupted);
const corruptResult = target().importBackupFrom(file('hong.sqlite'), actor);
assert.equal(corruptResult.ok, false);
assert.equal(corruptResult.error.code, 'corrupt');

const plain = new DatabaseSync(file('khong-phai-backup.sqlite'));
plain.exec('CREATE TABLE x(a); INSERT INTO x VALUES (1);');
plain.close();
assert.equal(target().importBackupFrom(file('khong-phai-backup.sqlite'), actor).error.code, 'wrong-format', 'SQLite lạ không có phần mô tả backup');

writeFileSync(file('ngau-nhien.bin'), Buffer.from('không phải tệp backup'));
assert.equal(target().importBackupFrom(file('ngau-nhien.bin'), actor).error.code, 'wrong-format');
assert.equal(target().importBackupFrom(file('khong-ton-tai.sqlite'), actor).error.code, 'not-found');

const futurePath = file('tuong-lai.sqlite');
writeFileSync(futurePath, readFileSync(backupPath));
const future = new DatabaseSync(futurePath);
future.prepare("UPDATE backup_info SET value=? WHERE key='schemaVersion'").run(String(SCHEMA_VERSION + 1));
future.close();
assert.equal(target().importBackupFrom(futurePath, actor).error.code, 'unsupported-schema');

// ── 5) Backup cũ thiếu cột mới: cột thiếu nhận giá trị mặc định ──────────
const oldPath = file('thieu-cot.sqlite');
writeFileSync(oldPath, readFileSync(backupPath));
const old = new DatabaseSync(oldPath);
old.exec('ALTER TABLE tests DROP COLUMN unit');
old.close();
const oldTarget = openDatabase(':memory:');
assert.equal(createBackupHandlers(oldTarget, dir).importBackupFrom(oldPath, actor).ok, true, 'backup thiếu cột vẫn phục hồi được');
assert.equal(createConfigHandlers(oldTarget).listTests()[0].name, 'Glucose');

// ── 6) Tệp .json cũ vẫn phục hồi được, và vẫn chặn checksum sai ─────────
const legacyPath = file('cu.json');
writeFileSync(legacyPath, JSON.stringify(buildBackupEnvelope(dumpAllTables(sourceDb), SCHEMA_VERSION, 'app', new Date().toISOString())));
const legacyVerified = verifyBackup.verifyBackupFile(legacyPath, actor);
assert.equal(legacyVerified.ok, true, JSON.stringify(legacyVerified));
assert.equal(legacyVerified.data.legacy, true);
const legacyDb = openDatabase(':memory:');
assert.equal(createBackupHandlers(legacyDb, dir).importBackupFrom(legacyPath, actor).ok, true);
assert.deepEqual(createConfigHandlers(legacyDb).listInstruments().map((i) => i.name), ['Máy A']);

const tampered = JSON.parse(readFileSync(legacyPath, 'utf8'));
tampered.data.instruments[0].name = 'Bị sửa đổi';
writeFileSync(file('cu-sua.json'), JSON.stringify(tampered));
assert.equal(target().importBackupFrom(file('cu-sua.json'), actor).error.code, 'checksum-mismatch');
writeFileSync(file('cu-hong.json'), '{khong-phai-json');
assert.equal(target().importBackupFrom(file('cu-hong.json'), actor).error.code, 'invalid-json');

// ── 7) Xoá sạch dữ liệu test ─────────────────────────────────────────────
const resetDb = openDatabase(':memory:');
const resetConfig = createConfigHandlers(resetDb);
const resetBackup = createBackupHandlers(resetDb, dir);
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { verifyAuditChain } = require('../../app-dist/main/domain/audit-chain.js');
const resetAuth = createAuthHandlers(resetDb);
await resetAuth.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị', password: 'mat-khau-dai-1' } });
const resetActor = { ...actor, userId: resetAuth.listUsers(actor).data[0].id, username: 'admin' };
const resetInstrument = resetConfig.saveInstrument({ data: { name: 'Máy sẽ bị xoá' } }, resetActor).data;
resetConfig.saveTest({ data: { name: 'Test sẽ bị xoá', instrumentId: resetInstrument.id } }, resetActor);
const usersBefore = resetAuth.listUsers(resetActor).data.length;
const activityBefore = listActivity(resetDb, 1000).length;
assert.ok(activityBefore > 0);

assert.equal(resetBackup.resetOperationalData(viewer).error.code, 'forbidden', 'chỉ admin được xoá sạch');
const reset = resetBackup.resetOperationalData(resetActor);
assert.equal(reset.ok, true);
assert.ok(reset.data.preResetSnapshotPath.endsWith('.sqlite') && existsSync(reset.data.preResetSnapshotPath), 'bản an toàn trước khi xoá là tệp SQLite');
assert.ok(reset.data.clearedTables.includes('instruments') && reset.data.clearedTables.includes('qc_points'), 'phải xoá bảng dữ liệu vận hành');
assert.ok(!reset.data.clearedTables.includes('users') && !reset.data.clearedTables.includes('activity'), 'KHÔNG được xoá users/activity');
assert.equal(resetConfig.listInstruments().length, 0, 'dữ liệu vận hành phải sạch');
const { createReagentHandlers } = require('../../app-dist/main/ipc/reagent-handlers.js');
const resetComparisons = createReagentHandlers(resetDb).listComparisons();
assert.equal(resetComparisons.length, 1, 'sau khi xoá sạch vẫn có một phép so sánh hoá chất trống để nhập');
assert.equal(resetComparisons[0].reagent, 'Hóa chất mới');
assert.equal(resetAuth.listUsers(resetActor).data.length, usersBefore, 'tài khoản phải còn nguyên');
const activityAfter = listActivity(resetDb, 1000);
assert.equal(activityAfter.length, activityBefore + 1, 'giữ nhật ký cũ + ghi thêm 1 dòng xoá sạch');
assert.equal(activityAfter[0].type, 'Xoá sạch dữ liệu');
const chain = verifyAuditChain(activityAfter.slice().reverse(), '');
assert.equal(chain.ok, true, 'chuỗi hash audit phải còn hợp lệ sau khi xoá sạch: ' + JSON.stringify(chain));
// Hồ sơ đơn vị trở về mặc định của schema (khớp blankAppState() hệ thống)
const { createSettingsHandlers } = require('../../app-dist/main/ipc/settings-handlers.js');
const resetSettings = createSettingsHandlers(resetDb, ':memory:');
assert.equal(resetSettings.getLabProfile().name, '', 'tên đơn vị trở về rỗng');
assert.equal(resetSettings.getLabProfile().brand_title, 'QC Lab', 'thương hiệu trở về mặc định');

// ── 8) Backup chỉ chạy trên máy chính ────────────────────────────────────
// Ba kênh backup không mở qua LAN và bước phục hồi không nhận đường dẫn tệp
// từ renderer: kiểm bằng hành vi ở tests/ipc-operations.test.mjs.

console.log('app backup-handlers end-to-end tests passed');
