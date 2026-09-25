// Quy tắc bắt buộc của mọi cổng ghi: kiểm quyền → kiểm dữ liệu → transaction
// → writeAudit() → notifyChanged(). Trước 2026-09-25 các handler tài khoản,
// NCE, so sánh hoá chất, khoá kỳ, hồ sơ đơn vị, LIS và lưu trữ nhật ký ghi dữ
// liệu KHÔNG trong transaction, còn chuyển lô ghi nhật ký SAU COMMIT: nếu bước
// nhật ký lỗi, dữ liệu đã đổi mà không để lại dấu vết.
//
// Cách kiểm: trigger chặn mọi lần ghi vào `activity`, gọi handler, rồi đối
// chiếu bảng dữ liệu không đổi một byte (cùng kỹ thuật với SG10).
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { withTransaction } = require('../../app-dist/main/ipc/shared.js');
const { nextNceId } = require('../../app-dist/main/db/nce-ids.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createAuthHandlers } = require('../../app-dist/main/ipc/auth-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { createReagentHandlers } = require('../../app-dist/main/ipc/reagent-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createSettingsHandlers } = require('../../app-dist/main/ipc/settings-handlers.js');
const { createLisHandlers } = require('../../app-dist/main/ipc/lis-handlers.js');
const { createAuditHandlers } = require('../../app-dist/main/ipc/audit-handlers.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test' };
const viewer = { ...admin, userId: 'u-viewer', username: 'viewer', role: 'viewer' };

function snapshot(db, tables) {
  return JSON.stringify(Object.fromEntries(tables.map((t) => [t, db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()])));
}
/** Chạy `write` khi nhật ký bị chặn: phải ném lỗi và không để lại thay đổi nào. */
function assertAtomic(db, tables, label, write) {
  const before = snapshot(db, [...tables, 'activity']);
  db.exec("CREATE TRIGGER atomic_fail_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'audit-fail'); END");
  try {
    // Nếu handler trả về lỗi kiểm tra thay vì ném, dữ liệu mẫu sai — báo rõ.
    assert.throws(() => { const r = write(); if (r && r.ok === false) throw new Error(`dữ liệu mẫu bị từ chối: ${r.error.code}`); }, /audit-fail/, `${label}: lỗi nhật ký phải làm thao tác thất bại`);
    assert.equal(snapshot(db, [...tables, 'activity']), before, `${label}: dữ liệu phải được hoàn nguyên`);
  } finally {
    db.exec('DROP TRIGGER atomic_fail_audit');
  }
}

/** Như `assertAtomic` cho handler bất đồng bộ (băm mật khẩu trước khi ghi). */
async function assertAtomicAsync(db, tables, label, write) {
  const before = snapshot(db, [...tables, 'activity']);
  db.exec("CREATE TRIGGER atomic_fail_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'audit-fail'); END");
  try {
    await assert.rejects(async () => { const r = await write(); if (r && r.ok === false) throw new Error(`dữ liệu mẫu bị từ chối: ${r.error.code}`); }, /audit-fail/, `${label}: lỗi nhật ký phải làm thao tác thất bại`);
    assert.equal(snapshot(db, [...tables, 'activity']), before, `${label}: dữ liệu phải được hoàn nguyên`);
  } finally {
    db.exec('DROP TRIGGER atomic_fail_audit');
  }
}

test('withTransaction: hoàn nguyên khi lỗi, lồng được, giữ lỗi gốc', () => {
  const db = openDatabase(':memory:');
  db.exec('CREATE TABLE t(v)');
  assert.throws(() => withTransaction(db, () => { db.exec('INSERT INTO t VALUES (1)'); throw new Error('goc'); }), /goc/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM t').get().n, 0);
  // Lồng: lỗi ở tầng trong bị bắt thì tầng ngoài vẫn commit phần của nó.
  withTransaction(db, () => {
    db.exec('INSERT INTO t VALUES (1)');
    try { withTransaction(db, () => { db.exec('INSERT INTO t VALUES (2)'); throw new Error('trong'); }); } catch { /* bỏ qua */ }
  });
  assert.deepEqual(db.prepare('SELECT v FROM t').all().map((r) => r.v), [1]);
  // Bên trong một BEGIN viết tay cũng dùng được.
  db.exec('BEGIN');
  withTransaction(db, () => db.exec('INSERT INTO t VALUES (3)'));
  db.exec('ROLLBACK');
  assert.deepEqual(db.prepare('SELECT v FROM t').all().map((r) => r.v), [1]);
  assert.throws(() => withTransaction(db, () => Promise.resolve()), /đồng bộ/);
});

test('tài khoản: tạo, sửa, đặt lại mật khẩu, xoá đều nguyên tử', async () => {
  const db = openDatabase(':memory:');
  const auth = createAuthHandlers(db);
  const boot = await auth.bootstrapAdmin({ data: { username: 'admin', name: 'Quản trị viên', password: 'mat-khau-dai-1' } });
  const actor = { ...admin, userId: boot.data.id };
  const user = (await auth.createUser({ data: { username: 'ktv1', name: 'Nguyễn Văn A', role: 'technician', password: 'ktv-pass-123' } }, actor)).data;
  await assertAtomicAsync(db, ['users'], 'createUser', () => auth.createUser({ data: { username: 'ktv2', name: 'Trần B', role: 'technician', password: 'ktv-pass-123' } }, actor));
  assertAtomic(db, ['users'], 'updateUser', () => auth.updateUser({ id: user.id, data: { name: 'Tên mới', role: 'technician', active: true } }, actor));
  await assertAtomicAsync(db, ['users'], 'resetPassword', () => auth.resetPassword({ id: user.id, data: { newPassword: 'mat-khau-moi-9' } }, actor));
  assertAtomic(db, ['users'], 'deleteUser', () => auth.deleteUser({ id: user.id }, actor));
});

test('NCE: tạo, huỷ, mở vòng tiếp theo đều nguyên tử; mã không trùng khi có khoảng trống', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const nce = createNceHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin).data;
  const input = { data: { testId: assay.id, level: 1, lot: 'L1', date: '2026-09-03', rule: '2-2s', errorType: 'SE', correction: 'Hiệu chuẩn lại và chạy lại QC', dueDate: '2026-09-10' } };
  const first = nce.create(input, admin).data;
  assertAtomic(db, ['actions'], 'nce.create', () => nce.create(input, admin));
  assertAtomic(db, ['actions'], 'nce.cancel', () => nce.cancel({ data: { id: first.id, note: 'Tạo nhầm hồ sơ' } }, admin));
  db.prepare("UPDATE actions SET effectiveness_status='ineffective' WHERE id=?").run(first.id);
  assertAtomic(db, ['actions'], 'nce.reopen', () => nce.reopenNce({ data: { id: first.id, note: 'Tái diễn' } }, admin));

  // Mã NCE: còn -01 và -03 (mất -02) thì mã kế tiếp phải là -04, không phải -03.
  const prefix = `NCE-${first.nce_id.slice(4, 12)}-`;
  db.prepare("UPDATE actions SET nce_id=? WHERE id=?").run(`${prefix}03`, first.id);
  db.prepare("INSERT INTO actions(id,date,created_at,updated_at,nce_id) VALUES ('khac','2026-09-03','x','x',?)").run(`${prefix}01`);
  assert.equal(nextNceId(db, `${first.nce_id.slice(4, 8)}-${first.nce_id.slice(8, 10)}-${first.nce_id.slice(10, 12)}`), `${prefix}04`);
});

test('so sánh hoá chất, khoá kỳ, hồ sơ đơn vị, LIS đều nguyên tử', () => {
  const db = openDatabase(':memory:');
  const reagent = createReagentHandlers(db);
  const report = createReportHandlers(db);
  const settings = createSettingsHandlers(db, ':memory:');
  const lis = createLisHandlers(db);
  const comparison = reagent.createComparison({ data: { name: 'Glucose' } }, admin).data;
  reagent.createComparison({ data: { name: 'Ure' } }, admin);
  assertAtomic(db, ['reagent_tests'], 'reagent.create', () => reagent.createComparison({ data: { name: 'Mới' } }, admin));
  assertAtomic(db, ['reagent_tests'], 'reagent.saveRows', () => reagent.saveRows({ id: comparison.id, rows: [['1', '2']] }, admin));
  assertAtomic(db, ['reagent_tests'], 'reagent.remove', () => reagent.removeComparison({ id: comparison.id }, admin));
  assertAtomic(db, ['app_meta'], 'reagent.addQuickValue', () => reagent.addQuickListValue({ type: 'operator', value: 'KTV A' }, admin));

  assertAtomic(db, ['period_locks'], 'report.lockPeriod', () => report.lockPeriod({ data: { ym: '2026-03', note: 'chốt kỳ' } }, admin));
  report.lockPeriod({ data: { ym: '2026-04', note: 'chốt kỳ' } }, admin);
  assertAtomic(db, ['period_locks'], 'report.unlockPeriod', () => report.unlockPeriod({ data: { ym: '2026-04', note: 'mở lại để sửa' } }, admin));

  assertAtomic(db, ['lab'], 'settings.saveLabProfile', () => settings.saveLabProfile({ data: { name: 'Khoa Xét nghiệm', dept: '', address: '', brandTitle: 'QC Lab', brandSub: '' } }, admin));
  assertAtomic(db, ['app_meta'], 'lis.saveSettings', () => lis.saveSettings({ data: { enabled: true, url: 'http://127.0.0.1:8787', token: 'tok' } }, admin));
});

test('LIS: vai trò chỉ-xem không được bỏ kết quả', async () => {
  const lis = createLisHandlers(openDatabase(':memory:'));
  const denied = await lis.rejectResult({ data: { messageId: 'm1', note: '' } }, viewer);
  assert.equal(denied.ok, false);
  assert.equal(denied.error.code, 'forbidden');
});

test('lưu trữ nhật ký: xoá, dời anchor và ghi dòng giải thích là một đơn vị', () => {
  const db = openDatabase(':memory:');
  const audit = createAuditHandlers(db);
  const insert = db.prepare("INSERT INTO activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
  for (let i = 1; i <= 3; i += 1) insert.run(`old-${i}`, i, '2020-01-0' + i + 'T00:00:00.000Z', 'x', 'x', 'x', 'admin', 'Cũ', '', '', 'c', '', '');
  assertAtomic(db, ['app_meta'], 'audit.archive', () => audit.archive({ data: { months: 12 } }, admin));
});

test('chuyển lô: hồ sơ, cascade và nhật ký là một đơn vị', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin).data;
  const panel = config.savePanel({ data: { name: 'Panel A', instrumentId: instrument.id, testIds: [assay.id] } }, admin).data;
  const running = config.saveLot({ data: { lotNo: 'RUN-1', level: 1, opened: '2026-02-10', exp: '2026-08-31' } }, admin).data;
  config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 200, sd: 5, qcLotId: running.id } }, admin);
  const candidate = config.saveLot({ data: { lotNo: 'CAND-1', level: 1, opened: '2026-04-02', exp: '2027-01-31' } }, admin).data;
  const data = { panelId: panel.id, fromLotId: running.id, toLotId: candidate.id, startDate: '2026-04-05', note: '', criteria: [{ testId: assay.id, level: 1, mean: 212, sd: 4.2 }] };
  const tables = ['lot_transitions', 'qc_lots', 'lot_groups', 'test_levels', 'tests'];
  assertAtomic(db, tables, 'createLotTransition (dự kiến)', () => config.createLotTransition({ data }, admin));
  const created = config.createLotTransition({ data }, admin).data;
  assertAtomic(db, tables, 'createLotTransition (chấp nhận, có cascade)', () => config.createLotTransition({ id: created.id, data: { ...data, status: 'accepted' } }, admin));
  // Không lỗi thì chấp nhận vẫn áp đúng như trước.
  const accepted = config.createLotTransition({ id: created.id, data: { ...data, status: 'accepted' } }, admin);
  assert.equal(accepted.ok, true, JSON.stringify(accepted));
  assert.equal(config.listTestLevels(assay.id).find((l) => l.level === 1).qc_lot_id, candidate.id);
});
