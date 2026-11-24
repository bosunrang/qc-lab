// GV4 mục 3 (2026-11-03, ISO 15189:2022 7.3.7.2): khoá kỳ khi kỳ còn lần chạy
// bị loại chưa có hồ sơ NCE hoặc hồ sơ NCE chưa đóng phải được xác nhận, và
// danh sách việc còn tồn được ghi vào nhật ký.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { periodOpenItems, periodOpenItemsText } = require('../../app-dist/main/domain/period-review.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

test('việc còn tồn của kỳ: lọc đúng tháng, hồ sơ không có lần chạy theo ngày phát hiện', () => {
  const queue = [
    { testId: 't1', date: '2026-10-05', runId: '2026-10-05-1', rejectedLevels: [], record: null, attachTo: null },
    { testId: 't1', date: '2026-10-07', runId: '2026-10-07-1', rejectedLevels: [], record: { id: 'n1', nceId: 'NCE-1' }, attachTo: null },
    { testId: 't1', date: '2026-09-30', runId: '2026-09-30-1', rejectedLevels: [], record: null, attachTo: null },
  ];
  const records = [
    { nceId: 'NCE-1', detectedAt: '2026-10-07', runDates: ['2026-10-07'] },
    { nceId: 'NCE-EQA', detectedAt: '2026-10-20T08:00:00.000Z', runDates: [] },
    { nceId: 'NCE-OLD', detectedAt: '2026-11-02', runDates: ['2026-09-28'] },
  ];
  const items = periodOpenItems('2026-10', queue, records);
  assert.deepEqual(items.unreviewedRuns.map((run) => run.runId), ['2026-10-05-1'], 'lần chạy đã có hồ sơ đang mở không tính hai lần');
  assert.deepEqual(items.openNceIds, ['NCE-1', 'NCE-EQA']);
  assert.equal(periodOpenItemsText(items, () => 'Glucose'), '1 lần chạy bị loại chưa có hồ sơ NCE (Glucose 05/10/2026 lần 2026-10-05-1); 2 hồ sơ NCE chưa đóng (NCE-1; NCE-EQA)');
});

test('khoá kỳ còn lần chạy bị loại: phải xác nhận, nhật ký ghi lại', () => {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), report = createReportHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'Máy A' } }, actor), 'máy');
  const t = must(config.saveTest({ data: { name: 'Glucose', instrumentId: inst.id } }, actor), 'xét nghiệm');
  makeOperationalQc(db, { testId: t.id, instrumentId: inst.id, assignments: [{ level: 1 }] });
  db.prepare('UPDATE test_levels SET mean=5, sd=0.2 WHERE test_id=? AND level=1').run(t.id);
  const lot = db.prepare('SELECT ql.lot_no FROM test_levels tl JOIN qc_lots ql ON ql.id=tl.qc_lot_id WHERE tl.test_id=?').get(t.id).lot_no;
  // 1-3s ngày 05/10: lần chạy bị loại, chưa có hồ sơ NCE.
  db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided)
    VALUES ('p1',?,1,'2026-10-05','2026-10-05-1',5.8,?,5,0.2,0)`).run(t.id, lot);

  // Kỳ chưa có biên bản xem xét tháng cũng là việc còn tồn (GV4 mục 2).
  assert.match(report.lockPeriod({ data: { ym: '2026-09' } }, actor).error?.message || '', /chưa có biên bản xem xét QC tháng/);
  must(report.signQcMonthlyReview({ data: { ym: '2026-09', conclusion: 'ok' } }, actor), 'ký xem xét 09');
  assert.equal(report.lockPeriod({ data: { ym: '2026-09' } }, actor).ok, true, 'kỳ không còn tồn thì khoá ngay');

  const blocked = report.lockPeriod({ data: { ym: '2026-10' } }, actor);
  assert.equal(blocked.error?.code, 'period-open-items');
  assert.match(blocked.error.message, /1 lần chạy bị loại chưa có hồ sơ NCE \(Glucose 05\/10\/2026 lần 2026-10-05-1\)/);
  assert.equal(report.isPeriodLocked('2026-10'), false);

  const locked = report.lockPeriod({ data: { ym: '2026-10', acknowledge: true } }, actor);
  assert.equal(locked.ok, true, JSON.stringify(locked));
  const audit = db.prepare("SELECT detail FROM activity WHERE type='Khoá kỳ báo cáo' ORDER BY seq DESC LIMIT 1").get().detail;
  assert.match(audit, /Khoá khi còn: 1 lần chạy bị loại chưa có hồ sơ NCE/);
  assert.equal(report.lockPeriod({ data: { ym: '2026-11', acknowledge: 'true' } }, actor).error?.code, 'period-open-items', 'chỉ nhận đúng true');
});
