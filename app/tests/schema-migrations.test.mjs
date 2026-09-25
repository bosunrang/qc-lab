// Migration schema có đánh số. Trước 2026-09-25 SCHEMA_VERSION đứng yên ở 1
// dù schema đã thêm khoảng 10 cột: chốt chặn "backup từ phiên bản mới hơn"
// không bao giờ kích hoạt, và dữ liệu cũ vừa phục hồi chỉ được chuẩn hoá ở lần
// khởi động sau. Phục hồi JSON còn gán NULL cho cột mà backup chưa có, nên vỡ
// ràng buộc NOT NULL (ví dụ `users.avatar`).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema, readSchemaVersion, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { dumpAllTables, restoreAllTables } = require('../../app-dist/main/db/table-io.js');

const columns = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

test('CSDL mới: chạy đủ mọi bước, ghi đúng phiên bản, có dòng hồ sơ đơn vị', () => {
  const db = openDatabase(':memory:');
  assert.ok(SCHEMA_VERSION >= 2);
  assert.equal(readSchemaVersion(db), SCHEMA_VERSION);
  assert.ok(columns(db, 'tests').includes('eflm_tea'), 'cột chỉ thêm bằng migration cũng có ở CSDL mới');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM lab WHERE id=1').get().n, 1);
});

test('CSDL cũ (phiên bản 1) thiếu cột: được nâng cấp, chạy lại không đổi gì', () => {
  const db = openDatabase(':memory:');
  db.exec('ALTER TABLE users DROP COLUMN avatar');
  db.prepare("UPDATE app_meta SET value='1' WHERE key='schemaVersion'").run();
  applySchema(db);
  assert.ok(columns(db, 'users').includes('avatar'));
  assert.equal(readSchemaVersion(db), SCHEMA_VERSION);
  applySchema(db);
  assert.equal(readSchemaVersion(db), SCHEMA_VERSION);
});

test('CSDL từ phiên bản mới hơn app: từ chối mở', () => {
  const db = openDatabase(':memory:');
  db.prepare("UPDATE app_meta SET value=? WHERE key='schemaVersion'").run(String(SCHEMA_VERSION + 1));
  assert.throws(() => applySchema(db), /phiên bản QC Lab mới hơn/);
});

test('phục hồi dữ liệu cũ: cột thiếu nhận mặc định, dữ liệu được chuẩn hoá ngay', () => {
  const source = openDatabase(':memory:');
  source.prepare("INSERT INTO users(id,username,name,initials,role,pass_hash,active,must_change_password) VALUES ('u1','ktv','KTV','K','technician','x',1,0)").run();
  source.prepare("INSERT INTO actions(id,date,nce_id,error_type) VALUES ('a1','2026-09-01','NCE-1','SE — Sai số hệ thống')").run();
  const data = dumpAllTables(source);
  // Bản xuất từ phiên bản 1: chưa có cột avatar, số phiên bản cũ.
  for (const row of data.users) delete row.avatar;
  data.app_meta = data.app_meta.map((row) => (row.key === 'schemaVersion' ? { ...row, value: '1' } : row));

  const target = openDatabase(':memory:');
  restoreAllTables(target, data);
  assert.equal(target.prepare("SELECT avatar FROM users WHERE id='u1'").get().avatar, '', 'cột thiếu nhận giá trị mặc định');
  assert.equal(target.prepare("SELECT error_type FROM actions WHERE id='a1'").get().error_type, 'SE', 'chuẩn hoá ngay, không đợi khởi động lại');
  assert.equal(readSchemaVersion(target), SCHEMA_VERSION);
});

test('phục hồi dữ liệu từ phiên bản mới hơn: huỷ cả lần phục hồi', () => {
  const source = openDatabase(':memory:');
  source.prepare("INSERT INTO instruments(id,name) VALUES ('i1','Máy từ tương lai')").run();
  const data = dumpAllTables(source);
  data.app_meta = data.app_meta.map((row) => (row.key === 'schemaVersion' ? { ...row, value: String(SCHEMA_VERSION + 1) } : row));
  const target = openDatabase(':memory:');
  target.prepare("INSERT INTO instruments(id,name) VALUES ('i0','Máy hiện có')").run();
  assert.throws(() => restoreAllTables(target, data), /phiên bản QC Lab mới hơn/);
  assert.deepEqual(target.prepare('SELECT name FROM instruments').all().map((r) => r.name), ['Máy hiện có'], 'dữ liệu hiện có giữ nguyên');
  assert.equal(readSchemaVersion(target), SCHEMA_VERSION);
});

test('phục hồi từ tệp backup SQLite cũ: dữ liệu được nâng cấp ngay', async () => {
  const { mkdtempSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { DatabaseSync } = await import('node:sqlite');
  const { createBackupHandlers } = require('../../app-dist/main/ipc/backup-handlers.js');
  const admin = { userId: 'u', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'c' };
  const dir = mkdtempSync(join(tmpdir(), 'qclab-mig-'));
  const source = openDatabase(':memory:');
  source.prepare("INSERT INTO actions(id,date,nce_id,error_type) VALUES ('a1','2026-09-01','NCE-1','RE — Sai số ngẫu nhiên')").run();
  const file = join(dir, 'cu.sqlite');
  assert.equal(createBackupHandlers(source, dir).exportBackupTo(file, admin).ok, true);
  // Biến tệp thành bản xuất từ phiên bản 1 chưa chuẩn hoá mã loại sai số.
  const old = new DatabaseSync(file);
  old.prepare("UPDATE app_meta SET value='1' WHERE key='schemaVersion'").run();
  old.prepare("UPDATE backup_info SET value='1' WHERE key='schemaVersion'").run();
  old.close();
  const target = openDatabase(':memory:');
  const restored = createBackupHandlers(target, dir).importBackupFrom(file, admin);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  assert.equal(target.prepare("SELECT error_type FROM actions WHERE id='a1'").get().error_type, 'RE');
  assert.equal(readSchemaVersion(target), SCHEMA_VERSION);
});
