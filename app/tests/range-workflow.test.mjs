// Quy trình dải kiểm soát end-to-end: SQLite + Westgard + điều kiện 20/20 +
// lưu dải PXN/hoàn dải NSX + lịch sử và hồ sơ chờ duyệt.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'Máy dải QC' } }, actor).data;
const test = config.saveTest({ data: { name: 'Range test', instrumentId: instrument.id, unit: 'U' } }, actor).data;
const lot = config.saveLot({ data: { lotNo: 'LOT-NEW', level: 1 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1, qcLotId: lot.id } }, actor).ok, true);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lot.id }] });

// Chưa đủ 20 ngày thì không được áp dụng.
for (let day = 1; day <= 19; day++) {
  const date = `2026-07-${String(day).padStart(2, '0')}`;
  assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date, val: day % 2 ? 9.8 : 10.2 } }, actor).ok, true);
}
let candidate = entry.rangeCandidate(test.id, 1);
assert.equal(candidate.ok, true);
assert.equal(candidate.data.proposed.n, 19);
assert.equal(candidate.data.proposed.days, 19);
assert.equal(candidate.data.eligible, false);
assert.equal(entry.applyLabRange({ data: { testId: test.id, level: 1, reason: 'Đề xuất dải từ dữ liệu đủ chuẩn' } }, actor).error.code, 'not-eligible');

assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-07-20', val: 10.2 } }, actor).ok, true);
candidate = entry.rangeCandidate(test.id, 1);
assert.equal(candidate.data.eligible, true);
assert.equal(candidate.data.proposed.rejected, 0);
assert.equal(candidate.data.proposed.warnings, 0);

const applied = entry.applyLabRange({ data: { testId: test.id, level: 1, reason: 'Đủ hai mươi ngày độc lập để lập dải' } }, actor);
assert.equal(applied.ok, true, JSON.stringify(applied));
assert.equal(applied.data.source, 'lab');
assert.equal(applied.data.canRevert, true);
const afterApply = config.listTestLevels(test.id)[0];
assert.equal(afterApply.mfg_mean, 10);
assert.equal(afterApply.mfg_sd, 1);
assert.equal(afterApply.mean, applied.data.current.mean);
assert.equal(JSON.parse(afterApply.mean_sd_history_json).length, 1);

const rangeAction = db.prepare("SELECT * FROM actions WHERE rule='Thiết lập dải QC mới'").get();
assert.ok(rangeAction, 'áp dụng dải phải tạo hồ sơ quản lý dải chờ duyệt');
assert.equal(rangeAction.approval_status, 'pending');

assert.equal(entry.revertManufacturerRange({ data: { testId: test.id, level: 1, reason: 'Hoàn lại dải NSX' } }, actor).ok, true);
const reverted = config.listTestLevels(test.id)[0];
assert.equal(reverted.applied, 'mfg');
assert.equal(reverted.mean, 10);
assert.equal(reverted.sd, 1);
assert.equal(JSON.parse(reverted.mean_sd_history_json).length, 2);

// Nếu có NCE sai số hệ thống, app cũ yêu cầu xác nhận nguyên nhân và Bias
// nằm trong TEa/4 trước khi cho đổi dải.
db.prepare("INSERT INTO actions(id,date,created_at,test_id,level,rule,nce_id) VALUES ('se-gate','2026-07-20','2026-07-20',?,?, '2-2s','NCE-SE-01')").run(test.id, 1);
assert.equal(entry.applyLabRange({ data: { testId: test.id, level: 1, reason: 'Thiết lập lại sau sai số hệ thống' } }, actor).error.code, 'cause-not-confirmed');
assert.equal(entry.applyLabRange({ data: { testId: test.id, level: 1, reason: 'Thiết lập lại sau sai số hệ thống', causeConfirmed: true, bias: 0 } }, actor).error.code, 'missing-tea');
db.prepare('UPDATE tests SET tea=8 WHERE id=?').run(test.id);
assert.equal(entry.applyLabRange({ data: { testId: test.id, level: 1, reason: 'Thiết lập lại sau sai số hệ thống', causeConfirmed: true, bias: 2.1 } }, actor).error.code, 'bias-out-of-range');
assert.equal(entry.applyLabRange({ data: { testId: test.id, level: 1, reason: 'Thiết lập lại sau sai số hệ thống', causeConfirmed: true, bias: 2 } }, actor).ok, true);

// Một điểm cảnh báo vẫn tham gia phép tính nhưng chặn điều kiện; app không
// được tự bỏ nó để làm đẹp SD.
const lot2 = config.saveLot({ data: { lotNo: 'LOT-WARN', level: 2 } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 20, sd: 1, qcLotId: lot2.id } }, actor);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 2, lotId: lot2.id }] });
for (let day = 1; day <= 20; day++) {
  const date = `2026-08-${String(day).padStart(2, '0')}`;
  const val = day === 20 ? 22.5 : (day % 2 ? 19.8 : 20.2);
  entry.addPoint({ data: { testId: test.id, level: 2, date, val } }, actor);
}
const warned = entry.rangeCandidate(test.id, 2);
assert.equal(warned.data.proposed.n, 20);
assert.ok(warned.data.proposed.warnings > 0 || warned.data.proposed.rejected > 0);
assert.equal(warned.data.eligible, false);

console.log('app range workflow end-to-end tests passed');
