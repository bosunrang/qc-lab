// Hồi quy cho tab "Nhóm lô đã dừng/lưu trữ": dữ liệu phải còn tra được sau
// khi xét nghiệm đã chuyển sang nhóm lô mới, và phải dùng Mean/SD ĐÃ CHỐT
// của lô cũ (không lấy nhầm Mean/SD vận hành hiện tại).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const entry = createEntryHandlers(db);
const westgard = createWestgardHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };

const instrument = config.saveInstrument({ data: { name: 'Máy lưu trữ' } }, actor).data;
const test = config.saveTest({ data: { name: 'Sodium lịch sử', instrumentId: instrument.id } }, actor).data;
const oldM1 = config.saveLot({ data: { lotNo: 'OLD-M1', level: 1 } }, actor).data;
const oldM2 = config.saveLot({ data: { lotNo: 'OLD-M2', level: 2 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 100, sd: 2, qcLotId: oldM1.id } }, actor).ok, true);
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 200, sd: 4, qcLotId: oldM2.id } }, actor).ok, true);
const oldOperational = makeOperationalQc(db, {
  testId: test.id, instrumentId: instrument.id,
  assignments: [{ level: 1, lotId: oldM1.id }, { level: 2, lotId: oldM2.id }],
});

// Cùng run: +2,5SD và -2,5SD. Lịch sử phải giữ được R4s liên mức, không
// chỉ tính hai chuỗi độc lập theo từng mức.
assert.equal(entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', runId: 'old-run-1', val: 105 } }, actor).ok, true);
assert.equal(entry.addPoint({ data: { testId: test.id, level: 2, date: '2026-09-01', runId: 'old-run-1', val: 190 } }, actor).ok, true);
assert.equal(config.stopLotGroup({ id: oldOperational.groupId }, actor).ok, true);

// Chuyển hẳn sang lô mới có Mean/SD khác: quá trình này phải chốt target cũ
// vào mean_sd_history_json để thẻ lưu trữ vẫn tính Z-score đúng.
const newM1 = config.saveLot({ data: { lotNo: 'NEW-M1', level: 1 } }, actor).data;
const newM2 = config.saveLot({ data: { lotNo: 'NEW-M2', level: 2 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 110, sd: 1, qcLotId: newM1.id } }, actor).ok, true);
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 210, sd: 2, qcLotId: newM2.id } }, actor).ok, true);
makeOperationalQc(db, {
  testId: test.id, instrumentId: instrument.id,
  assignments: [{ level: 1, lotId: newM1.id }, { level: 2, lotId: newM2.id }],
});

const archivedTests = westgard.listArchivedGroupTests(oldOperational.groupId);
assert.deepEqual(archivedTests.map((item) => item.id), [test.id]);
const blocks = westgard.listArchivedBlocks(test.id, oldOperational.groupId);
assert.equal(blocks.length, 2, 'nhóm lô cũ phải trả đủ hai mức đã dùng');
assert.deepEqual(blocks.map((block) => [block.level, block.lotNo, block.mean, block.sd]), [
  [1, 'OLD-M1', 100, 2],
  [2, 'OLD-M2', 200, 4],
]);
assert.equal(blocks[0].analysis.points[0].z, 2.5, 'Z của lô cũ phải dùng Mean/SD cũ: (105-100)/2');
assert.equal(blocks[1].analysis.points[0].z, -2.5, 'Z của lô cũ phải dùng Mean/SD cũ: (190-200)/4');
assert.ok(blocks.every((block) => block.analysis.points[0].rules.includes('R4s')), 'R4s liên mức của nhóm lô đã dừng phải được giữ lại');
assert.deepEqual(blocks.map((block) => block.analysis.points[0].verdict), ['rej', 'rej'], 'cả hai điểm cấu thành R4s lịch sử phải bị loại');
// Lý do loại theo LẦN CHẠY cũng phải đi kèm ở tab lô lịch sử, đúng trường mà
// `entry:queryPoints` trả — ba đường đọc mô tả cùng một điểm bằng cùng hình
// dạng, nếu không màn hình chỉ bớt được điểm khỏi thống kê mà không nói vì sao.
assert.deepEqual(blocks.map((block) => block.analysis.points[0].runRejectedBy), [[1, 2], [1, 2]],
  'cả hai mức của lần chạy R4s đều là lý do lần chạy bị loại');

console.log('app archived Westgard history end-to-end tests passed');


