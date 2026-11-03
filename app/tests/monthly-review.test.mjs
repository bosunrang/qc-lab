// Biên bản xem xét dữ liệu QC theo tháng (GV4 mục 2, ISO 15189:2022 7.3.7.2,
// 2026-11-03): main tổng hợp số liệu tháng theo đúng kết luận Westgard của
// các trang khác, người có quyền `qc.config` ký kết luận, lần ký lưu kèm ảnh
// chụp số liệu; khoá kỳ chưa có biên bản là việc còn tồn cần xác nhận.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { must } from './helpers/nce-flow.mjs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { summarizeReviewGroup, validateReviewSignature } = require('../../app-dist/main/domain/monthly-review.js');
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');

const admin = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };
const tech = { userId: 'u2', username: 'ktv', name: 'KTV', role: 'technician', clientId: 'test' };

test('tổng hợp một nhóm: thống kê trên kết quả được chấp nhận, so với đích', () => {
  const p = (val, status = 'accepted', qcMean = 100, qcSd = 2, date = '2026-10-01') => ({ date, val, qcMean, qcSd, status });
  const stats = summarizeReviewGroup([p(101), p(103), p(102), p(120, 'rejected'), p(99, 'unevaluated')]);
  assert.deepEqual([stats.n, stats.accepted, stats.rejected, stats.unevaluated], [5, 3, 1, 1]);
  assert.equal(stats.mean, 102);
  assert.equal(stats.sd, 1);
  assert.equal(stats.shiftSd, 1, '(102 − 100) / 2');
  assert.equal(stats.biasPct, 2);
  assert.equal(stats.targetChanged, false);
  const changed = summarizeReviewGroup([p(101, 'accepted', 100, 2, '2026-10-01'), p(111, 'accepted', 110, 3, '2026-10-20')]);
  assert.deepEqual([changed.targetMean, changed.targetSd, changed.targetChanged], [110, 3, true], 'đích lấy theo điểm mới nhất, đánh dấu đổi đích');
});

test('kiểm tra khi ký: tháng chưa tới, kết luận, nhận xét bắt buộc khi cần theo dõi', () => {
  assert.equal(validateReviewSignature({ ym: '2026-12', conclusion: 'ok' }, '2026-11-03').code, 'future-period');
  assert.equal(validateReviewSignature({ ym: '2026-10', conclusion: 'x' }, '2026-11-03').code, 'invalid-conclusion');
  assert.equal(validateReviewSignature({ ym: '2026-10', conclusion: 'monitor', note: 'ngắn' }, '2026-11-03').code, 'note-required');
  assert.equal(validateReviewSignature({ ym: '2026-10', conclusion: 'ok' }, '2026-11-03').ok, true);
});

function scenario() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), report = createReportHandlers(db);
  const inst = must(config.saveInstrument({ data: { name: 'Máy A' } }, admin), 'máy');
  const t = must(config.saveTest({ data: { name: 'Glucose', instrumentId: inst.id, unit: 'mmol/L' } }, admin), 'xét nghiệm');
  makeOperationalQc(db, { testId: t.id, instrumentId: inst.id, assignments: [{ level: 1 }] });
  db.prepare('UPDATE test_levels SET mean=5, sd=0.2 WHERE test_id=? AND level=1').run(t.id);
  const lot = db.prepare('SELECT ql.lot_no FROM test_levels tl JOIN qc_lots ql ON ql.id=tl.qc_lot_id WHERE tl.test_id=?').get(t.id).lot_no;
  const ins = db.prepare(`INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided,void_rejection_json) VALUES (?,?,1,?,?,?,?,5,0.2,?,?)`);
  ins.run('a', t.id, '2026-10-01', '2026-10-01-1', 5.1, lot, 0, '');
  ins.run('b', t.id, '2026-10-02', '2026-10-02-1', 4.9, lot, 0, '');
  ins.run('c', t.id, '2026-10-03', '2026-10-03-1', 5.8, lot, 0, ''); // 1-3s: lần chạy bị loại
  ins.run('d', t.id, '2026-10-04', '2026-10-04-1', 6.0, lot, 1, '{"rules":["1-3s"],"rejectedLevels":[1]}'); // đã huỷ
  ins.run('e', t.id, '2026-09-30', '2026-09-30-1', 5.0, lot, 0, ''); // tháng khác
  db.prepare(`INSERT INTO nce_records(id,nce_id,source,test_id,detected_at,status,error_class) VALUES ('n1','NCE-01','iqc',?,'2026-10-03','open','RE')`).run(t.id);
  db.prepare(`INSERT INTO nce_runs(id,nce_record_id,test_id,date,run_id,role,snapshot_json) VALUES ('r1','n1',?,'2026-10-03','2026-10-03-1','trigger','{}')`).run(t.id);
  return { db, report, testId: t.id, lot };
}

test('số liệu tháng theo xét nghiệm × mức × lô, kèm điểm huỷ và NCE', () => {
  const { report, lot } = scenario();
  const review = report.getQcMonthlyReview('2026-10');
  assert.equal(review.rows.length, 1);
  const [row] = review.rows;
  assert.deepEqual([row.test_name, row.instrument_name, row.level, row.lot], ['Glucose', 'Máy A', 1, lot]);
  assert.deepEqual([row.n, row.accepted, row.rejected, row.voided, row.voided_rejected], [3, 2, 1, 1, 1]);
  assert.ok(Math.abs(row.mean - 5) < 1e-9, 'Mean chỉ trên 2 kết quả được chấp nhận');
  assert.deepEqual([review.totals.points, review.totals.rejected_runs, review.totals.nce, review.totals.nce_open], [3, 1, 1, 1]);
  assert.deepEqual(review.nce.map((n) => n.nce_id), ['NCE-01']);
  assert.match(review.open_items, /1 hồ sơ NCE chưa đóng \(NCE-01\)/);
  assert.doesNotMatch(review.open_items, /biên bản/, 'trang biên bản không tự nhắc chính nó');
  assert.deepEqual(review.signatures, []);
});

test('ký xem xét: cần quyền qc.config, lưu ảnh chụp, ký lại giữ lịch sử, khoá kỳ đọc được', () => {
  const { db, report } = scenario();
  db.prepare("INSERT INTO users(id,username,name,role,pass_hash,active) VALUES ('u2','ktv','KTV','technician','x',1)").run();
  assert.equal(report.signQcMonthlyReview({ data: { ym: '2026-10', conclusion: 'ok' } }, tech).error?.code, 'forbidden-qc-config');
  assert.equal(report.signQcMonthlyReview({ data: { ym: '2026-10', conclusion: 'action', note: '' } }, admin).error?.code, 'note-required');

  const first = must(report.signQcMonthlyReview({ data: { ym: '2026-10', conclusion: 'monitor', note: 'Theo dõi Glucose sau lần chạy 03/10' } }, admin), 'ký');
  assert.equal(first.conclusion, 'monitor');
  const snapshot = JSON.parse(db.prepare('SELECT summary_json FROM qc_month_reviews WHERE id=?').get(first.id).summary_json);
  assert.equal(snapshot.totals.points, 3, 'lưu số liệu lúc ký');
  const audit = db.prepare("SELECT detail FROM activity WHERE type='Ký biên bản xem xét QC'").get().detail;
  assert.match(audit, /Kỳ 2026-10: Cần theo dõi thêm — Theo dõi Glucose.*3 kết quả, 1 lần chạy bị loại, 1 điểm huỷ, 1\/1 hồ sơ NCE chưa đóng/);

  must(report.signQcMonthlyReview({ data: { ym: '2026-10', conclusion: 'ok' } }, admin), 'ký lại');
  assert.deepEqual(report.getQcMonthlyReview('2026-10').signatures.map((s) => s.conclusion), ['monitor', 'ok']);

  // Đã có biên bản: khoá kỳ chỉ còn nhắc NCE chưa đóng, không nhắc biên bản.
  const blocked = report.lockPeriod({ data: { ym: '2026-10' } }, admin);
  assert.equal(blocked.error?.code, 'period-open-items');
  assert.doesNotMatch(blocked.error.message, /biên bản/);
  assert.match(report.lockPeriod({ data: { ym: '2026-08' } }, admin).error?.message || '', /chưa có biên bản xem xét QC tháng/);
});
