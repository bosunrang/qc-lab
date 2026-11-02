// Toàn vẹn nhật ký (gói GV3 của kế hoạch khắc phục 2026-10-31):
// - lần đăng nhập sai cũng ghi nhật ký, kèm nơi thử (máy chính / `lan:<ip>`);
// - chế độ vận hành bật một chiều, chặn "Xoá sạch dữ liệu thử", và không bị
//   tắt khi phục hồi một backup cũ hơn lúc bật.
// Phần "vượt ngưỡng không tự xoá nhật ký" nằm ở audit-handlers.test.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listActivity } from './helpers/activity.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { createBackupHandlers } = require('../../app-dist/main/ipc/backup-handlers.js');
const { createSettingsHandlers } = require('../../app-dist/main/ipc/settings-handlers.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { verifyAuditChain } = require('../../app-dist/main/domain/audit-chain.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'app-desktop' };
const viewer = { ...admin, userId: 'u-view', username: 'xem', role: 'viewer' };

async function authFixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const auth = createAuthHandlers(db);
  assert.equal((await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị', password: 'admin12345' } })).ok, true);
  return { db, auth };
}

test('đăng nhập sai ghi nhật ký với lý do và nơi thử, không ghi mật khẩu', async (t) => {
  const { db, auth } = await authFixture(t);

  const wrong = await auth.login({ data: { username: 'admin', password: 'mat-khau-sai-123' } });
  assert.equal(wrong.error.code, 'invalid-credentials');
  let row = listActivity(db, 1)[0];
  assert.equal(row.type, 'Đăng nhập thất bại');
  assert.equal(row.username, 'admin');
  assert.equal(row.clientId, 'app-desktop');
  assert.match(row.detail, /Sai mật khẩu · máy chính/);
  assert.doesNotMatch(row.detail, /mat-khau-sai-123/);

  // Tài khoản không tồn tại: thông báo cho người dùng vẫn chung một câu, chỉ
  // nhật ký mới phân biệt được.
  const ghost = await auth.login({ data: { username: 'khong-co', password: 'x' } }, 'lan:192.168.1.5');
  assert.equal(ghost.error.message, wrong.error.message);
  row = listActivity(db, 1)[0];
  assert.equal(row.username, 'khong-co');
  assert.equal(row.userId, '');
  assert.equal(row.clientId, 'lan:192.168.1.5');
  assert.match(row.detail, /Tài khoản không tồn tại · máy trạm LAN 192\.168\.1\.5/);

  db.prepare("UPDATE users SET active=0 WHERE username='admin'").run();
  const locked = await auth.login({ data: { username: 'admin', password: 'admin12345' } });
  assert.equal(locked.error.code, 'inactive');
  assert.match(listActivity(db, 1)[0].detail, /Tài khoản đã bị khoá/);

  // Thiếu tên hoặc mật khẩu là lỗi nhập, không phải một lần thử: không ghi.
  const before = listActivity(db).length;
  await auth.login({ data: { username: '', password: '' } });
  assert.equal(listActivity(db).length, before);

  assert.equal(verifyAuditChain(listActivity(db).reverse(), '').ok, true, 'dòng đăng nhập sai nối đúng chuỗi hash');
});

test('đăng nhập thành công từ máy trạm ghi clientId lan:<ip>', async (t) => {
  const { db, auth } = await authFixture(t);
  assert.equal((await auth.login({ data: { username: 'admin', password: 'admin12345' } }, 'lan:10.0.0.7')).ok, true);
  const row = listActivity(db, 1)[0];
  assert.equal(row.type, 'Đăng nhập');
  assert.equal(row.clientId, 'lan:10.0.0.7');
  assert.match(row.detail, /máy trạm LAN 10\.0\.0\.7/);
});

function backupFixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const dir = mkdtempSync(path.join(os.tmpdir(), 'qclab-opmode-'));
  const config = createConfigHandlers(db);
  assert.equal(config.saveInstrument({ data: { name: 'Máy A' } }, admin).ok, true);
  return { db, dir, backup: createBackupHandlers(db, dir), settings: createSettingsHandlers(db, ':memory:') };
}
const instrumentCount = (db) => db.prepare('SELECT COUNT(*) AS n FROM instruments').get().n;

test('chế độ vận hành: một chiều, chỉ admin, chặn xoá sạch', (t) => {
  const { db, backup, settings } = backupFixture(t);
  const status = backup.backupStatus();
  assert.equal(status.operationMode, null);
  assert.equal(status.activityRows, db.prepare('SELECT COUNT(*) AS n FROM activity').get().n);

  assert.equal(settings.enableOperationMode(viewer).error.code, 'forbidden');
  assert.equal(backup.backupStatus().operationMode, null);

  const enabled = settings.enableOperationMode(admin);
  assert.equal(enabled.ok, true, JSON.stringify(enabled));
  assert.equal(enabled.data.enabledBy, 'Quản trị');
  assert.equal(listActivity(db, 1)[0].type, 'Bật chế độ vận hành');
  assert.deepEqual(backup.backupStatus().operationMode, enabled.data);

  // Bật lại: không đổi mốc, không thêm dòng nhật ký.
  const rows = listActivity(db).length;
  const again = settings.enableOperationMode(admin);
  assert.deepEqual(again.data, enabled.data);
  assert.equal(listActivity(db).length, rows);

  const reset = backup.resetOperationalData(admin);
  assert.equal(reset.ok, false);
  assert.equal(reset.error.code, 'operation-mode');
  assert.equal(instrumentCount(db), 1, 'dữ liệu còn nguyên');
});

test('phục hồi backup cũ hơn lúc bật không tắt chế độ vận hành', (t) => {
  const { dir, backup, settings } = backupFixture(t);
  const oldBackup = path.join(dir, 'truoc-van-hanh.sqlite');
  assert.equal(backup.exportBackupTo(oldBackup, admin).ok, true);
  const enabled = settings.enableOperationMode(admin).data;

  const restored = backup.importBackupFrom(oldBackup, admin);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  assert.deepEqual(backup.backupStatus().operationMode, enabled);
  assert.equal(backup.resetOperationalData(admin).error.code, 'operation-mode');
});
