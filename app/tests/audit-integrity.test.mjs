// Toàn vẹn nhật ký (gói GV3 của kế hoạch khắc phục 2026-10-31):
// - lần đăng nhập sai cũng ghi nhật ký, kèm nơi thử (máy chính / `lan:<ip>`);
// - chế độ vận hành bật một chiều, chặn "Xoá sạch dữ liệu thử", và không bị
//   tắt khi phục hồi một backup cũ hơn lúc bật;
// - phục hồi (đánh giá 2026-11-05, A19–A22): không xoá cứng điểm QC ở chế độ
//   vận hành, gộp nhật ký thay vì thay, cùng một giao dịch, giữ khoá riêng của máy.
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

// A20 (đánh giá 2026-11-05): ở chế độ vận hành, phục hồi không được xoá cứng
// điểm QC. Bản sao lưu thiếu điểm đang có, hoặc còn điểm mà ở đây đã huỷ, bị
// chặn trước khi chạm vào dữ liệu; bản đủ điểm thì vẫn phục hồi được.
function pointFixture(db) {
  const config = createConfigHandlers(db);
  const instrumentId = db.prepare('SELECT id FROM instruments LIMIT 1').get().id;
  const testId = config.saveTest({ data: { name: 'Natri', instrumentId, unit: 'mmol/L' } }, admin).data.id;
  const insert = db.prepare("INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,1,?,?,?,'LOT-1',140,2,0)");
  return (id, date) => insert.run(id, testId, date, `${date}-1`, 140);
}
const pointIds = (db) => db.prepare('SELECT id, voided FROM qc_points ORDER BY id').all().map((p) => `${p.id}:${p.voided}`);

test('chế độ vận hành: chặn phục hồi bản thiếu điểm QC hoặc mất dấu huỷ', (t) => {
  const { db, dir, backup, settings } = backupFixture(t);
  const addPoint = pointFixture(db);
  addPoint('p1', '2026-11-01');
  const older = path.join(dir, 'cu.sqlite');
  assert.equal(backup.exportBackupTo(older, admin).ok, true);
  settings.enableOperationMode(admin);

  addPoint('p2', '2026-11-02');
  const activity = listActivity(db).length;
  const blocked = backup.importBackupFrom(older, admin);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, 'operation-mode');
  assert.match(blocked.error.message, /thiếu 1 điểm QC/);
  assert.deepEqual(pointIds(db), ['p1:0', 'p2:0'], 'điểm nhập sau bản sao lưu còn nguyên');
  assert.equal(listActivity(db).length, activity, 'bị chặn thì không ghi gì');

  const withBoth = path.join(dir, 'du-diem.sqlite');
  assert.equal(backup.exportBackupTo(withBoth, admin).ok, true);
  db.prepare("UPDATE qc_points SET voided=1 WHERE id='p1'").run();
  assert.equal(backup.importBackupFrom(withBoth, admin).error.code, 'operation-mode', 'bản sao lưu còn điểm chưa huỷ làm mất dấu huỷ');
  assert.deepEqual(pointIds(db), ['p1:1', 'p2:0']);

  const latest = path.join(dir, 'moi-nhat.sqlite');
  assert.equal(backup.exportBackupTo(latest, admin).ok, true);
  const restored = backup.importBackupFrom(latest, admin);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  assert.deepEqual(pointIds(db), ['p1:1', 'p2:0']);
});

test('ngoài chế độ vận hành: phục hồi bản cũ vẫn được (dữ liệu thử)', (t) => {
  const { db, dir, backup } = backupFixture(t);
  const addPoint = pointFixture(db);
  const older = path.join(dir, 'cu.sqlite');
  assert.equal(backup.exportBackupTo(older, admin).ok, true);
  addPoint('p1', '2026-11-01');
  assert.equal(backup.importBackupFrom(older, admin).ok, true);
  assert.deepEqual(pointIds(db), []);
});

// A19: phục hồi thay dữ liệu nhưng không xoá nhật ký. Dòng nhật ký phát sinh
// sau bản sao lưu được nối tiếp sau nhật ký của bản sao lưu, chuỗi hash vẫn
// xác minh được từ anchor của bản sao lưu.
test('phục hồi gộp nhật ký: giữ các dòng phát sinh sau bản sao lưu', async (t) => {
  const { buildBackupEnvelope } = require('../../app-dist/main/domain/backup.js');
  const { dumpAllTables } = require('../../app-dist/main/db/table-io.js');
  const { SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
  const { writeFileSync } = await import('node:fs');
  for (const kind of ['sqlite', 'json']) {
    const { db, dir, backup } = backupFixture(t);
    const file = path.join(dir, `ban-sao-luu.${kind}`);
    if (kind === 'sqlite') assert.equal(backup.exportBackupTo(file, admin).ok, true);
    else writeFileSync(file, JSON.stringify(buildBackupEnvelope(dumpAllTables(db), SCHEMA_VERSION, 'app', new Date().toISOString())));
    const backedUp = new Set(listActivity(db, 1000).map((row) => row.id));

    assert.equal(createConfigHandlers(db).saveInstrument({ data: { name: 'Máy B' } }, admin).ok, true);
    const after = listActivity(db, 1000).filter((row) => !backedUp.has(row.id));
    assert.ok(after.some((row) => /Máy B/.test(row.detail)), 'có dòng nhật ký sau bản sao lưu');

    const restored = backup.importBackupFrom(file, admin);
    assert.equal(restored.ok, true, JSON.stringify(restored));
    assert.deepEqual(db.prepare('SELECT name FROM instruments').all().map((r) => r.name), ['Máy A'], `${kind}: dữ liệu lấy theo bản sao lưu`);
    const rows = listActivity(db, 1000);
    for (const row of after) assert.ok(rows.some((r) => r.id === row.id && r.detail === row.detail), `${kind}: giữ dòng "${row.type}"`);
    assert.equal(rows[0].type, 'Phục hồi từ bản sao lưu');
    // Bản SQLite còn thiếu cả dòng "Xuất sao lưu" của chính nó (ghi sau khi xuất).
    const kept = Number(rows[0].detail.match(/giữ (\d+) dòng nhật ký/)?.[1]);
    assert.ok(kept >= after.length, `${kind}: ${rows[0].detail}`);
    const anchor = db.prepare("SELECT value FROM app_meta WHERE key='activityAnchor'").get()?.value ?? '';
    const chain = verifyAuditChain(rows.slice().reverse(), anchor);
    assert.equal(chain.ok, true, `${kind}: chuỗi hash hợp lệ sau khi gộp: ${JSON.stringify(chain)}`);
    const seqs = rows.map((r) => r.seq);
    assert.equal(new Set(seqs).size, seqs.length, `${kind}: số thứ tự không trùng`);
  }
});

// A21: phục hồi lỗi giữa chừng thì không còn gì thay đổi — dữ liệu, cờ chế độ
// vận hành và nhật ký cùng một giao dịch.
test('phục hồi lỗi giữa chừng: dữ liệu, cờ và nhật ký đều giữ nguyên', async (t) => {
  const { buildBackupEnvelope } = require('../../app-dist/main/domain/backup.js');
  const { dumpAllTables } = require('../../app-dist/main/db/table-io.js');
  const { SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
  const { writeFileSync } = await import('node:fs');
  const { db, dir, backup, settings } = backupFixture(t);
  const data = dumpAllTables(db);
  createConfigHandlers(db).saveTest({ data: { name: 'Glucose', instrumentId: data.instruments[0].id } }, admin);
  // Xét nghiệm trỏ tới máy không tồn tại: kiểm khoá ngoại cuối lần phục hồi thất bại.
  const broken = { ...data, tests: [{ ...dumpAllTables(db).tests[0], instrument_id: 'khong-ton-tai' }] };
  const file = path.join(dir, 'hong-khoa-ngoai.json');
  writeFileSync(file, JSON.stringify(buildBackupEnvelope(broken, SCHEMA_VERSION, 'app', new Date().toISOString())));
  const enabled = settings.enableOperationMode(admin).data;
  const activity = listActivity(db, 1000).length;

  const result = backup.importBackupFrom(file, admin);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'restore-failed');
  assert.deepEqual(db.prepare('SELECT name FROM tests').all().map((r) => r.name), ['Glucose']);
  assert.deepEqual(backup.backupStatus().operationMode, enabled);
  assert.equal(listActivity(db, 1000).length, activity, 'không có dòng nhật ký "Phục hồi" khi phục hồi thất bại');
  assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1, 'khoá ngoại được bật lại');
});

// A22: phục hồi từ tệp không lấy khoá riêng của máy trong bản sao lưu (cấu
// hình LIS kèm token, kết nối Firebase), giống đồng bộ Firebase.
test('phục hồi giữ khoá riêng của máy trong app_meta', (t) => {
  const { db, dir, backup } = backupFixture(t);
  const setMeta = db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  setMeta.run('lisGatewaySettings', 'cua-ban-sao-luu');
  setMeta.run('firebaseLabCode', 'ban-sao-luu');
  const file = path.join(dir, 'may-khac.sqlite');
  assert.equal(backup.exportBackupTo(file, admin).ok, true);
  setMeta.run('lisGatewaySettings', 'cua-may-nay');
  db.prepare("DELETE FROM app_meta WHERE key='firebaseLabCode'").run();

  assert.equal(backup.importBackupFrom(file, admin).ok, true);
  const meta = (key) => db.prepare('SELECT value FROM app_meta WHERE key=?').get(key)?.value;
  assert.equal(meta('lisGatewaySettings'), 'cua-may-nay');
  assert.equal(meta('firebaseLabCode'), undefined, 'không nhận kết nối Firebase của máy khác');
});
