// CSDL của app chạy ở chế độ WAL (kế hoạch kiến trúc, mục E.3). Khoá ba điều:
// tệp thật mở ở WAL và vẫn đồng bộ FULL; backup và bản an toàn (`VACUUM INTO`)
// là tệp SQLite thường, đọc được ở chế độ chỉ đọc mà không để lại tệp phụ,
// kể cả khi dữ liệu mới còn nằm trong `-wal`; đóng kết nối thì `-wal` được gộp.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createBackupHandlers } = require('../../app-dist/main/ipc/backup-handlers.js');
const { createSettingsHandlers } = require('../../app-dist/main/ipc/settings-handlers.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

function freshDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'qclab-wal-test-'));
}

test('tệp CSDL mở ở chế độ WAL, đồng bộ FULL', () => {
  const dir = freshDir();
  const dbPath = path.join(dir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  try {
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    // 2 = FULL: mất điện không làm mất thao tác đã báo thành công.
    assert.equal(Number(db.prepare('PRAGMA synchronous').get().synchronous), 2);
  } finally {
    db.close();
  }
});

test('backup và bản an toàn là tệp SQLite thường, chứa cả dữ liệu còn trong -wal', () => {
  const dir = freshDir();
  const dbPath = path.join(dir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  try {
    const config = createConfigHandlers(db);
    config.saveInstrument({ data: { name: 'Máy WAL' } }, actor);
    assert.ok(existsSync(`${dbPath}-wal`), 'thay đổi vừa ghi còn nằm trong tệp -wal');

    const settings = createSettingsHandlers(db, dbPath);
    const walBytes = readFileSync(`${dbPath}-wal`).length;
    const mainBytes = readFileSync(dbPath).length;
    assert.equal(settings.getStorageInfo().dbFileBytes, mainBytes + walBytes, 'cỡ dữ liệu tính cả tệp -wal');

    const backupDir = freshDir();
    const backupPath = path.join(backupDir, 'backup.sqlite');
    const backup = createBackupHandlers(db, dir);
    const exported = backup.exportBackupTo(backupPath, actor);
    assert.equal(exported.ok, true, JSON.stringify(exported));

    // Byte 18–19 của phần đầu tệp SQLite: 1 là journal thường, 2 là WAL.
    const header = readFileSync(backupPath).subarray(18, 20);
    assert.deepEqual([...header], [1, 1], 'tệp backup không mang cờ WAL');

    const copy = new DatabaseSync(backupPath, { readOnly: true });
    try {
      assert.deepEqual(copy.prepare('SELECT name FROM instruments').all().map((r) => r.name), ['Máy WAL']);
    } finally {
      copy.close();
    }
    assert.deepEqual(readdirSync(backupDir), ['backup.sqlite'], 'đọc tệp backup không để lại -wal/-shm');

    // Phục hồi vào chính CSDL WAL: tạo bản an toàn rồi chép lại từ tệp.
    config.saveInstrument({ data: { name: 'Máy thêm sau backup' } }, actor);
    const restored = backup.importBackupFrom(backupPath, actor);
    assert.equal(restored.ok, true, JSON.stringify(restored));
    assert.deepEqual(config.listInstruments().map((i) => i.name), ['Máy WAL']);
    const snapshotHeader = readFileSync(restored.data.preRestoreSnapshotPath).subarray(18, 20);
    assert.deepEqual([...snapshotHeader], [1, 1], 'bản an toàn không mang cờ WAL');
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal', 'phục hồi không đổi chế độ journal');
  } finally {
    db.close();
  }
});

test('đóng kết nối thì -wal được gộp vào tệp chính', () => {
  const dir = freshDir();
  const dbPath = path.join(dir, 'qclab.sqlite');
  const db = openDatabase(dbPath);
  createConfigHandlers(db).saveInstrument({ data: { name: 'Máy trước khi tắt' } }, actor);
  db.close();
  assert.equal(existsSync(`${dbPath}-wal`), false);

  const reopened = new DatabaseSync(dbPath, { readOnly: true });
  try {
    assert.deepEqual(reopened.prepare('SELECT name FROM instruments').all().map((r) => r.name), ['Máy trước khi tắt']);
  } finally {
    reopened.close();
  }
});
