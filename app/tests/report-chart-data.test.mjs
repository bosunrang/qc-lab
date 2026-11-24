// Báo cáo dùng cùng kết luận với Westgard; cắt ngày chỉ cắt phần trình bày,
// không làm mất bằng chứng luật nhiều lần chạy ở trước ngày bắt đầu.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { receivePendingRejectedRuns } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createWestgardHandlers } = require('../../app-dist/main/ipc/westgard-handlers.js');
const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'report-test' };
const must = (result) => { assert.equal(result.ok, true, JSON.stringify(result)); return result.data; };

function setup(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  const config = createConfigHandlers(db), entry = createEntryHandlers(db);
  const instrument = must(config.saveInstrument({ data: { name: 'Máy báo cáo' } }, actor));
  const examination = must(config.saveTest({ data: { name: 'Xét nghiệm hai mức', instrumentId: instrument.id } }, actor));
  for (const [level, mean, sd] of [[1, 10, 1], [2, 100, 2]]) must(config.saveTestLevel({ testId: examination.id, data: { level, mean, sd } }, actor));
  const operational = makeOperationalQc(db, { testId: examination.id, instrumentId: instrument.id, assignments: [{ level: 1 }, { level: 2 }] });
  for (const date of ['2026-10-01', '2026-10-02']) for (const [level, val] of [[1, 12.5], [2, 100]]) {
    must(entry.addPoint({ data: { testId: examination.id, level, date, runId: '1', val } }, actor));
  }
  return { db, config, entry, operational, testId: examination.id, report: createReportHandlers(db), westgard: createWestgardHandlers(db) };
}

test('dữ liệu biểu đồ báo cáo: giữ 2-2s từ trước khoảng ngày và loại theo cả lần chạy', (t) => {
  const { report, westgard, testId } = setup(t);
  const rows = report.queryReport({ testId, from: '2026-10-02', to: '2026-10-02' });
  assert.equal(rows.length, 2);
  const m1 = rows.find((point) => point.level === 1), m2 = rows.find((point) => point.level === 2);
  assert.ok(m1.rules.includes('2-2s'));
  assert.equal(m1.verdict, 'rej');
  assert.equal(m2.verdict, 'ok');
  assert.equal(m2.accepted, false);
  assert.deepEqual(m2.run_rejected_by, [1]);
  for (const row of rows) {
    const point = westgard.analyzeLevel(testId, row.level).points.find((item) => item.id === row.id);
    assert.equal(row.z, point.z);
    assert.equal(row.verdict, point.verdict);
    assert.equal(row.accepted, point.accepted);
    assert.deepEqual(row.rules, point.rules);
  }
});

test('dữ liệu biểu đồ báo cáo: Mean/SD đã chốt, điểm huỷ và dữ liệu chưa đánh giá', (t) => {
  const { db, report, entry, testId } = setup(t);
  db.prepare('UPDATE test_levels SET mean=1000,sd=50 WHERE test_id=? AND level=1').run(testId);
  const before = report.queryReport({ testId });
  const target = before.find((point) => point.level === 1);
  assert.equal(target.target_mean, 10);
  assert.equal(target.target_sd, 1);
  assert.equal(target.z, 2.5);
  must(entry.voidPoint({ data: { pointId: target.id, reason: 'Nhập nhầm giá trị, lưu lại dấu vết', kind: 'data-entry' } }, actor));
  const voided = report.queryReport({ testId }).find((point) => point.id === target.id);
  assert.equal(voided.voided, 1);
  assert.equal(voided.z, null);
  assert.equal(voided.verdict, 'none');
  assert.equal(voided.accepted, false);
  db.prepare('UPDATE test_levels SET qc_lot_id=NULL WHERE test_id=?').run(testId);
  const unassessed = report.queryReport({ testId }).filter((point) => !point.voided);
  assert.ok(unassessed.length);
  assert.ok(unassessed.every((point) => point.verdict === 'none' && point.z === null && !point.accepted));
});

test('dữ liệu biểu đồ báo cáo: lô cũ trên chuỗi chuyển tiếp dùng đúng Mean/SD và kết luận lịch sử', (t) => {
  const { db, config, operational, testId, report, westgard } = setup(t);
  const oldId = operational.lotIds[0];
  const oldLot = db.prepare('SELECT lot_no FROM qc_lots WHERE id=?').get(oldId).lot_no;
  const nextLot = must(config.saveLot({ data: { lotNo: 'NEW-REPORT', level: 1 } }, actor));
  db.prepare('UPDATE qc_lots SET group_id=? WHERE id=?').run(operational.groupId, nextLot.id);
  db.prepare('UPDATE test_levels SET qc_lot_id=?,mean=200,sd=10,mean_sd_history_json=? WHERE test_id=? AND level=1')
    .run(nextLot.id, JSON.stringify([{ at: '2026-10-03T00:00:00Z', qcLotId: oldId, mean: 10, sd: 1 }]), testId);
  db.prepare("INSERT INTO lot_transitions(id,panel_id,from_lot_id,to_lot_id,status,start_date,approved_at) VALUES ('report-transition',?,?,?,'accepted','2026-10-03','2026-10-03T00:00:00Z')")
    .run(operational.panelId, oldId, nextLot.id);
  const rows = report.queryReport({ testId, from: '2026-10-01', to: '2026-10-02' }).filter((point) => point.level === 1);
  const historical = westgard.listPreviousLotBlocks(testId).find((block) => block.lotNo === oldLot);
  assert.equal(rows.length, 2);
  assert.ok(historical);
  for (const row of rows) {
    const point = historical.analysis.points.find((item) => item.id === row.id);
    assert.equal(row.target_mean, 10);
    assert.equal(row.target_sd, 1);
    assert.equal(row.z, point.z);
    assert.equal(row.verdict, point.verdict);
  }
});

test('dữ liệu biểu đồ báo cáo: nhóm dừng thủ công vẫn khớp tab Westgard lưu trữ', (t) => {
  const { db, config, operational, testId, report, westgard } = setup(t);
  // Lần chạy bị loại phải có hồ sơ NCE trước khi dừng nhóm lô (R03).
  receivePendingRejectedRuns(db, actor);
  must(config.stopLotGroup({ id: operational.groupId }, actor));
  assert.deepEqual(westgard.analyzeLevel(testId, 1).points, []);
  const blocks = westgard.listArchivedBlocks(testId, operational.groupId);
  const expected = new Map(blocks.flatMap((block) => block.analysis.points.map((point) => [point.id, point])));
  const rows = report.queryReport({ testId });
  assert.equal(rows.length, 4);
  for (const row of rows) {
    assert.equal(row.z, expected.get(row.id).z);
    assert.equal(row.verdict, expected.get(row.id).verdict);
    assert.equal(row.accepted, expected.get(row.id).accepted);
  }
});
