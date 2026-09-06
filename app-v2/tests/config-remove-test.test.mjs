// Cổng xoá xét nghiệm: chỉ cấu hình hoàn toàn mới được xoá. Bất kỳ điểm QC,
// Mean/SD, lô, Sigma hay NCE nào cũng biến nó thành hồ sơ phải lưu vết; khi
// đó người dùng chỉ được chuyển sang "Ngừng sử dụng".
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-v2-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-v2-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-v2-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-v2-dist/main/ipc/nce-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const nce = createNceHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };
const viewer = { ...actor, role: 'viewer' };

const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mg/dL' } }, actor).data;
config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1 } }, actor);
const panel = config.savePanel({ data: { name: 'Panel 1', instrumentId: instrument.id, testIds: [test.id] } }, actor).data;
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, panelId: panel.id, assignments: [{ level: 1 }] });

// 1) chỉ admin được xoá
const forbidden = config.removeTest({ id: test.id }, viewer);
assert.equal(forbidden.ok, false);
assert.equal(forbidden.error.code, 'forbidden');

// 2) thêm 1 điểm QC vi phạm rồi huỷ kèm kind=analytical -> tự mở hồ sơ NCE
const point = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-08-02', val: 14 } }, actor);
assert.equal(point.ok, true);
const voided = entry.voidPoint({ data: { pointId: point.data.id, kind: 'analytical' } }, actor);
assert.equal(voided.ok, true);
assert.ok(voided.data.nceId, 'huỷ điểm kind=analytical phải tự mở hồ sơ NCE');
const nceBefore = nce.listRecords().find((r) => r.test_id === test.id);
assert.ok(nceBefore, 'phải có đúng 1 hồ sơ NCE gắn với xét nghiệm này trước khi xoá');

// 3) đã có lịch sử thì luôn bị chặn, bất kể kỳ báo cáo đang mở hay khoá.
const blocked = config.removeTest({ id: test.id }, actor);
assert.equal(blocked.ok, false);
assert.equal(blocked.error.code, 'has-history');
assert.equal(config.listTests().length, 1, 'bị chặn thì KHÔNG được xoá gì cả');
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM qc_points WHERE test_id=?').get(test.id).n, 1);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM test_levels WHERE test_id=?').get(test.id).n, 1);

// 4) cấu hình mới, chưa có dữ liệu vẫn được xoá và chỉ gỡ khỏi Panel.
const pristine = config.saveTest({ data: { name: 'ALT', instrumentId: instrument.id, unit: 'U/L' } }, actor).data;
config.savePanel({ id: panel.id, data: { name: 'Panel 1', instrumentId: instrument.id, testIds: [test.id, pristine.id] } }, actor);
const removed = config.removeTest({ id: pristine.id }, actor);
assert.equal(removed.ok, true, JSON.stringify(removed));
assert.equal(removed.data.pointsCount, 0);
assert.deepEqual(config.listTests().map((row) => row.id), [test.id]);
const panelAfter = config.listPanels().find((p) => p.id === panel.id);
assert.deepEqual(panelAfter.testIds, [test.id], 'Panel QC phải giữ xét nghiệm có lịch sử và chỉ gỡ cấu hình mới');

// 5) Hồ sơ NCE và xét nghiệm nguồn còn nguyên sau lần xoá bị từ chối.
const nceAfter = nce.listRecords().find((r) => r.id === nceBefore.id);
assert.ok(nceAfter, 'hồ sơ NCE không được biến mất');
assert.equal(nceAfter.test_id, test.id);
assert.deepEqual(nceAfter, nceBefore, 'toàn bộ nội dung hồ sơ NCE không đổi');

console.log('app-v2 config-remove-test end-to-end tests passed');
