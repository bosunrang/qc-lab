// WG-24: cột lô song song phải đi qua ĐÚNG đường đánh giá ghép như chuỗi đang
// vận hành — luật liên mức (R4s/2-2s/2of3-2s/3-1s) và mốc "đã khắc phục xong"
// đều phải áp. Bản trước gọi `westgardByPoint()` cho TỪNG cột, tức chỉ kênh
// trong-mức, nên hai mức của lô mới đo cùng một lần chạy mà lệch ngược chiều
// nhau thì không luật nào nổ — đúng lúc thẩm định lô mới lại là lúc cổng lỏng
// nhất.
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

const instrument = config.saveInstrument({ data: { name: 'Máy 2 mức' } }, actor).data;
const test = config.saveTest({ data: { name: 'Natri chuyển lô', instrumentId: instrument.id } }, actor).data;
const panel = config.savePanel({ data: { name: 'Panel 2 mức', instrumentId: instrument.id, testIds: [test.id] } }, actor).data;
const oldLot1 = config.saveLot({ data: { lotNo: 'OLD-L1', level: 1 } }, actor).data;
const oldLot2 = config.saveLot({ data: { lotNo: 'OLD-L2', level: 2 } }, actor).data;
const newLot1 = config.saveLot({ data: { lotNo: 'NEW-L1', level: 1 } }, actor).data;
const newLot2 = config.saveLot({ data: { lotNo: 'NEW-L2', level: 2 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, qcLotId: oldLot1.id, mean: 10, sd: 1 } }, actor).ok, true);
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 2, qcLotId: oldLot2.id, mean: 30, sd: 1 } }, actor).ok, true);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, panelId: panel.id, assignments: [{ level: 1, lotId: oldLot1.id }, { level: 2, lotId: oldLot2.id }] });

// Mỗi hồ sơ chuyển lô nối MỘT cặp lô, nên hai mức cần hai hồ sơ.
for (const [fromLot, toLot, level, mean] of [[oldLot1, newLot1, 1, 20], [oldLot2, newLot2, 2, 40]]) {
  const result = config.createLotTransition({ data: {
    panelId: panel.id, fromLotId: fromLot.id, toLotId: toLot.id, startDate: '2026-09-01', status: 'active',
    criteria: [{ testId: test.id, level, mean, sd: 2 }],
  } }, actor);
  assert.equal(result.ok, true, JSON.stringify(result));
}
assert.deepEqual(entry.listParallelColumns(test.id).map((column) => [column.level, column.lot]), [[1, 'NEW-L1'], [2, 'NEW-L2']]);

// CÙNG một lần chạy trên lô mới: mức 1 = +2,5SD, mức 2 = −2,5SD → biên độ 5SD.
// Không mức nào tự vượt ±3SD, nên chỉ kênh trong-mức thì cả hai chỉ "Cảnh báo".
const p1 = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', lotNo: 'NEW-L1', val: 25 } }, actor);
const p2 = entry.addPoint({ data: { testId: test.id, level: 2, date: '2026-09-02', runId: '2026-09-02-1', lotNo: 'NEW-L2', val: 35 } }, actor);
assert.equal(p1.ok, true, JSON.stringify(p1));
assert.equal(p2.ok, true, JSON.stringify(p2));

// Chốt lại tiền đề: chạy RIÊNG từng mức (đúng cách bản trước làm) thì không
// luật nào bắt được cặp này — nếu ca test vẫn xanh sau khi ai đó quay về
// `westgardByPoint()` per-column, nó đã mất ý nghĩa.
const { westgardByPoint } = require('../../app-dist/main/domain/westgard-engine.js');
assert.deepEqual(
  westgardByPoint([{ val: 25, qcMean: 20, qcSd: 2 }], 20, 2, () => true).F[0].rules,
  ['1-2s'],
  'chỉ kênh trong-mức: +2,5SD mới là cảnh báo 1-2s, không có R4s',
);

const columns = entry.listParallelColumns(test.id);
const point = (level) => columns.find((column) => column.level === level).points[0];
for (const level of [1, 2]) {
  assert.ok(point(level).rules.includes('R4s'), `mức ${level} phải nổ R4s liên mức trên lô song song`);
  assert.equal(point(level).verdict, 'rej', `mức ${level} phải là Loại bỏ, không phải Cảnh báo`);
  assert.equal(point(level).accepted, false, 'điểm bị loại không được vào thống kê lô mới');
}

// Lô ĐANG VẬN HÀNH không bị ảnh hưởng: hai dòng dữ liệu tách nhau.
const mainOk = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-03', runId: '2026-09-03-1', val: 10.1 } }, actor);
assert.equal(mainOk.ok, true);
assert.equal(mainOk.data.verdict, 'ok', 'vi phạm trên lô song song không làm bẩn lô chính');
assert.deepEqual(entry.queryPoints(test.id, 1).map((row) => row.id), [mainOk.data.id]);

// Một lần chạy sạch trên lô song song vẫn được nhận vào thống kê.
assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-04', runId: '2026-09-04-1', lotNo: 'NEW-L1', val: 20.4 } }, actor).ok, true);
assert.equal(entry.addPoint({ data: { testId: test.id, level: 2, date: '2026-09-04', runId: '2026-09-04-1', lotNo: 'NEW-L2', val: 40.4 } }, actor).ok, true);
const clean = entry.listParallelColumns(test.id).find((column) => column.level === 1).points.find((row) => row.date === '2026-09-04');
assert.deepEqual(clean.rules, []);
assert.equal(clean.verdict, 'ok');
assert.equal(clean.accepted, true);

console.log('app entry parallel-lot cross-level tests passed');
