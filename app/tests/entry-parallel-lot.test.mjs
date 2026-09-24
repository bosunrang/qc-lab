// End-to-end cho nhập song song hai lô: lô ứng viên chỉ tồn tại khi hồ sơ
// chuyển lô active, dùng Mean/SD riêng và không làm bẩn Westgard lô chính.
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
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'Máy chuyển lô' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose chuyển lô', instrumentId: instrument.id } }, actor).data;
const panel = config.savePanel({ data: { name: 'Panel chuyển lô', instrumentId: instrument.id, testIds: [test.id] } }, actor).data;
const oldLot = config.saveLot({ data: { lotNo: 'OLD-101', level: 1 } }, actor).data;
const newLot = config.saveLot({ data: { lotNo: 'NEW-202', level: 1 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, qcLotId: oldLot.id, mean: 10, sd: 1 } }, actor).ok, true);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, panelId: panel.id, assignments: [{ level: 1, lotId: oldLot.id }] });

const planned = config.createLotTransition({ data: {
  panelId: panel.id, fromLotId: oldLot.id, toLotId: newLot.id, startDate: '2026-09-01', status: 'planned',
  criteria: [{ testId: test.id, level: 1, mean: 20, sd: 2 }],
} }, actor);
assert.equal(planned.ok, true, JSON.stringify(planned));
assert.equal(entry.listParallelColumns(test.id).length, 0, 'hồ sơ dự kiến chưa được mở cột song song');

const active = config.createLotTransition({ id: planned.data.id, data: {
  panelId: panel.id, fromLotId: oldLot.id, toLotId: newLot.id, startDate: '2026-09-01', status: 'active',
  criteria: [{ testId: test.id, level: 1, mean: 20, sd: 2 }],
} }, actor);
assert.equal(active.ok, true, JSON.stringify(active));
const columns = entry.listParallelColumns(test.id);
assert.equal(columns.length, 1);
assert.deepEqual({ lot: columns[0].lot, level: columns[0].level, mean: columns[0].mean, sd: columns[0].sd }, { lot: 'NEW-202', level: 1, mean: 20, sd: 2 });

const mainPoint = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', val: 10.1 } }, actor);
assert.equal(mainPoint.ok, true);
const parallelPoint = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', lotNo: 'NEW-202', val: 26.2 } }, actor);
assert.equal(parallelPoint.ok, true, JSON.stringify(parallelPoint));
assert.equal(parallelPoint.data.verdict, 'rej');
assert.ok(parallelPoint.data.rules.includes('1-3s'));

const mainRows = entry.queryPoints(test.id, 1);
assert.equal(mainRows.length, 1, 'điểm lô song song không được vào tập lô chính');
assert.equal(mainRows[0].id, mainPoint.data.id);
assert.equal(mainRows[0].verdict, 'ok', 'vi phạm lô song song không làm đổi verdict lô chính');
const parallelRows = entry.listParallelColumns(test.id)[0].points;
assert.equal(parallelRows.length, 1);
assert.equal(parallelRows[0].id, parallelPoint.data.id);
const stored = db.prepare('SELECT lot,qc_mean,qc_sd FROM qc_points WHERE id=?').get(parallelPoint.data.id);
assert.equal(stored.lot, 'NEW-202');
assert.equal(stored.qc_mean, 20);
assert.equal(stored.qc_sd, 2);

const forged = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-03', lotNo: 'LOT-KHONG-HOP-LE', val: 20 } }, actor);
assert.equal(forged.ok, false);
assert.equal(forged.error.code, 'invalid-parallel-lot');

// Chấp nhận chuyển lô: cột song song biến mất và các điểm NEW-202 trở thành
// tập đang vận hành mà không cần chép/chuyển hàng dữ liệu.
const accepted = config.createLotTransition({ id: planned.data.id, data: {
  panelId: panel.id, fromLotId: oldLot.id, toLotId: newLot.id, startDate: '2026-09-01', status: 'accepted',
  criteria: [{ testId: test.id, level: 1, mean: 20, sd: 2 }],
} }, actor);
assert.equal(accepted.ok, true, JSON.stringify(accepted));
assert.equal(entry.listParallelColumns(test.id).length, 0);
const afterAccept = entry.queryPoints(test.id, 1);
assert.equal(afterAccept.length, 1);
assert.equal(afterAccept[0].id, parallelPoint.data.id);
assert.equal(afterAccept[0].verdict, 'rej');

// Lô vừa được thay thế vẫn xem lại được trong Nhập QC bằng đúng dải lịch sử;
// điểm lô cũ không bị trộn trở lại chuỗi Westgard đang vận hành.
const previous = entry.listPreviousLotSeries(test.id);
assert.equal(previous.length, 1);
assert.deepEqual({ level: previous[0].level, lot: previous[0].lot, mean: previous[0].mean, sd: previous[0].sd },
  { level: 1, lot: 'OLD-101', mean: 10, sd: 1 });
assert.equal(previous[0].points.length, 1);
assert.equal(previous[0].points[0].id, mainPoint.data.id);
assert.equal(previous[0].points[0].verdict, 'ok');

console.log('app entry parallel-lot end-to-end tests passed');


