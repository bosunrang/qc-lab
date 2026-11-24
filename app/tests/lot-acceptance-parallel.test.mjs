// N12 (2026-11-03): chấp nhận lô QC mới đòi dữ liệu chạy song song tối thiểu
// (10 kết quả trên 10 ngày cho mỗi xét nghiệm/mức), đếm đúng các kết quả của
// cột song song ở Nhập QC và bỏ kết quả thuộc lần chạy bị loại.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
import { seedParallelRun } from './helpers/parallel-run.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { parallelRunStats, PARALLEL_MIN_DAYS, PARALLEL_MIN_RESULTS } = require('../../app-dist/main/domain/parallel-acceptance.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

test('thống kê chạy song song bỏ lần chạy bị loại', () => {
  assert.deepEqual([PARALLEL_MIN_RESULTS, PARALLEL_MIN_DAYS], [10, 10]);
  const days = Array.from({ length: 10 }, (_, i) => `2026-05-${String(i + 1).padStart(2, '0')}`);
  const ok = days.map((date) => ({ date, verdict: 'ok' }));
  assert.deepEqual(parallelRunStats(ok), { n: 10, days: 10, rejected: 0, enough: true });
  assert.equal(parallelRunStats([...ok.slice(1), { date: days[0], verdict: 'rej' }]).enough, false, 'kết quả bị loại không được đếm');
  assert.equal(parallelRunStats([...ok.slice(1), { date: days[0], verdict: 'ok', runRejectedBy: [2] }]).rejected, 1, 'lần chạy bị mức khác làm hỏng');
  assert.equal(parallelRunStats(ok.map((point) => ({ ...point, date: days[0] }))).enough, false, '10 kết quả cùng một ngày chưa đủ');
});

function scenario() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'Máy A' } }, actor), 'máy');
  const t = must(config.saveTest({ data: { name: 'Glucose', instrumentId: inst.id } }, actor), 'xét nghiệm');
  const panel = must(config.savePanel({ data: { name: 'Panel', instrumentId: inst.id, testIds: [t.id] } }, actor), 'panel');
  const oldLot = must(config.saveLot({ data: { lotNo: 'OLD', level: 1 } }, actor), 'lô cũ');
  const newLot = must(config.saveLot({ data: { lotNo: 'NEW', level: 1 } }, actor), 'lô mới');
  must(config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 5, sd: 0.2, qcLotId: oldLot.id } }, actor), 'mức');
  const criteria = [{ testId: t.id, level: 1, mean: 6, sd: 0.25 }];
  const data = { panelId: panel.id, fromLotId: oldLot.id, toLotId: newLot.id, startDate: '2026-05-01', criteria };
  const transition = must(config.createLotTransition({ data: { ...data, status: 'active' } }, actor), 'hồ sơ');
  const accept = () => config.createLotTransition({ id: transition.id, data: { ...data, status: 'accepted' } }, actor);
  return { db, config, testId: t.id, transitionId: transition.id, accept };
}

test('thiếu dữ liệu song song thì chưa chấp nhận, nói rõ còn thiếu bao nhiêu', () => {
  const { db, testId, transitionId, accept } = scenario();
  seedParallelRun(db, { transitionId, testId, level: 1, lotNo: 'NEW', mean: 6, sd: 0.25, start: '2026-05-01', days: 9 });
  const short = accept();
  assert.equal(short.error?.code, 'parallel-insufficient');
  assert.match(short.error.message, /Glucose M1: 9 kết quả \/ 9 ngày/);
  assert.equal(db.prepare('SELECT status FROM lot_transitions WHERE id=?').get(transitionId).status, 'active', 'bị chặn thì không đổi gì');
});

test('kết quả bị loại không được tính vào đủ 10', () => {
  const { db, testId, transitionId, accept } = scenario();
  seedParallelRun(db, { transitionId, testId, level: 1, lotNo: 'NEW', mean: 6, sd: 0.25, start: '2026-05-01', days: 10 });
  // Một ngày vượt +3SD theo Mean/SD ứng viên.
  db.prepare("UPDATE qc_points SET val=7 WHERE test_id=? AND date='2026-05-10'").run(testId);
  const short = accept();
  assert.equal(short.error?.code, 'parallel-insufficient');
  assert.match(short.error.message, /9 kết quả \/ 9 ngày, bỏ 1 điểm thuộc lần chạy bị loại/);

  db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided)
    VALUES ('extra',?,1,'2026-05-11','2026-05-11-1',6,'NEW',6,0.25,0)`).run(testId);
  const ok = accept();
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const audit = db.prepare("SELECT detail FROM activity WHERE type='Áp dụng chuyển tiếp lô'").get().detail;
  assert.match(audit, /Dữ liệu song song: Glucose M1: 10 kết quả \/ 10 ngày, bỏ 1 điểm/);
});

test('chuyển thẳng từ Dự kiến sang Chấp nhận không có dữ liệu song song', () => {
  const { db, config, testId } = scenario();
  const oldLot = db.prepare("SELECT id FROM qc_lots WHERE lot_no='OLD'").get().id;
  const other = must(config.saveLot({ data: { lotNo: 'NEW-2', level: 1 } }, actor), 'lô khác');
  const panelId = db.prepare('SELECT id FROM qc_panels').get().id;
  const data = { panelId, fromLotId: oldLot, toLotId: other.id, criteria: [{ testId, level: 1, mean: 6, sd: 0.25 }] };
  const planned = must(config.createLotTransition({ data }, actor), 'dự kiến');
  assert.equal(config.createLotTransition({ id: planned.id, data: { ...data, status: 'accepted' } }, actor).error?.code, 'parallel-insufficient');
});
