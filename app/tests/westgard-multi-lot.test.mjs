// Hồi quy cho hai ưu tiên nghiệp vụ của Nhập QC/Westgard:
// 1) chỉ dùng điểm thuộc đúng lô hiện đang gán cho từng mức;
// 2) đánh giá liên mức theo cùng run và tôn trọng scope within/across/both.
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

const instrument = config.saveInstrument({ data: { name: 'Máy đa mức' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose đa mức', instrumentId: instrument.id } }, actor).data;
const lot1 = config.saveLot({ data: { lotNo: 'LOT-L1-CU', level: 1 } }, actor).data;
const lot2 = config.saveLot({ data: { lotNo: 'LOT-L2-CU', level: 2 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1, qcLotId: lot1.id } }, actor).ok, true);
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 2, mean: 20, sd: 1, qcLotId: lot2.id } }, actor).ok, true);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lot1.id }, { level: 2, lotId: lot2.id }] });

// Cùng ngày + cùng chỉ số run: +2.1SD và -2.1SD phải kích hoạt R4s liên mức.
const runId = '2026-09-01-1';
const high = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-01', runId, val: 12.1 } }, actor);
const low = entry.addPoint({ data: { testId: test.id, level: 2, date: '2026-09-01', runId, val: 17.9 } }, actor);
assert.equal(high.ok, true); assert.equal(low.ok, true);

const level1AfterPair = entry.queryPoints(test.id, 1);
const level2AfterPair = entry.queryPoints(test.id, 2);
assert.deepEqual(level1AfterPair[0].rules, ['1-2s', 'R4s']);
assert.deepEqual(level2AfterPair[0].rules, ['1-2s', 'R4s']);
assert.equal(level1AfterPair[0].verdict, 'rej');
assert.equal(level2AfterPair[0].verdict, 'rej');

const analysis1 = westgard.analyzeLevel(test.id, 1);
assert.deepEqual(analysis1.points[0].rules, ['1-2s', 'R4s']);
assert.equal(analysis1.points[0].verdict, 'rej');
const summary = westgard.listTestSummaries().find((item) => item.testId === test.id);
assert.equal(summary.levels.find((item) => item.level === 1).worstVerdict, 'rej');
assert.equal(summary.levels.find((item) => item.level === 2).worstVerdict, 'rej');

// R4s chỉ có kênh liên mức; không được cho phép lưu scope "within" vì sẽ
// làm luật tắt âm thầm. Muốn vô hiệu hóa luật phải dùng action rõ ràng.
const invalidR4sScope = config.saveRuleScope(test.id, 'R4s', 'within', actor);
assert.equal(invalidR4sScope.ok, false);
assert.equal(invalidR4sScope.error.code, 'invalid-scope');
assert.equal(westgard.saveRuleAction(test.id, 'R4s', 'inactive', actor).ok, true);
const withoutAcross = entry.queryPoints(test.id, 1)[0];
assert.equal(withoutAcross.verdict, 'warn');
assert.deepEqual(withoutAcross.rules, ['1-2s']);

// Chuyển Mức 1 sang lô mới: điểm của LOT-L1-CU phải biến mất khỏi worksheet,
// phân tích và thống kê hiện hành; điểm cũ vẫn còn nguyên trong SQLite để tra
// cứu lịch sử/audit.
const lot1New = config.saveLot({ data: { lotNo: 'LOT-L1-MOI', level: 1 } }, actor).data;
assert.equal(config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 10, sd: 1, qcLotId: lot1New.id } }, actor).ok, true);
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lot1New.id }] });
assert.equal(entry.queryPoints(test.id, 1).length, 0, 'điểm lô cũ không được lẫn vào lô đang vận hành');
assert.equal(westgard.analyzeLevel(test.id, 1).points.length, 0);

const current = entry.addPoint({ data: { testId: test.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', val: 10.2 } }, actor);
assert.equal(current.ok, true);
assert.equal(current.data.verdict, 'ok');
const currentRows = entry.queryPoints(test.id, 1);
assert.equal(currentRows.length, 1);
assert.equal(currentRows[0].id, current.data.id);
const currentSummary = westgard.listTestSummaries().find((item) => item.testId === test.id).levels.find((item) => item.level === 1);
assert.equal(currentSummary.pointCount, 1);
assert.equal(currentSummary.worstVerdict, 'ok');

const oldStillStored = db.prepare('SELECT id,lot FROM qc_points WHERE id=?').get(high.data.id);
assert.equal(oldStillStored.lot, 'LOT-L1-CU', 'đổi lô không được xóa hoặc sửa mất điểm lịch sử');

console.log('current-lot + multi-level Westgard tests passed');


