// Hồi quy cho sáu vấn đề nghiệp vụ của đợt rà soát 10/11/2026
// (`docs/APP-REVIEW-2026-11-10.md`, R01–R06). Ca thử dựng lại từ
// `docs/app-review-probes-2026-11-10.cjs`, nay khẳng định hành vi đúng.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { createIqcNce, ensureUser } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createEqaHandlers } = require('../../app-dist/main/ipc/eqa-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { nceQueueRows } = require('../../app-dist/main/db/nce-evaluation.js');
const { reviewDataFingerprint } = require('../../app-dist/main/domain/monthly-review.js');
const { validateLockPeriod } = require('../../app-dist/main/domain/period-lock-validation.js');

const admin = { userId: 'review-admin', username: 'review', name: 'Người rà soát', role: 'admin', clientId: 'review' };
const must = (result) => { assert.equal(result.ok, true, JSON.stringify(result.error)); return result.data; };

/** Xét nghiệm 2 mức (Mean 100/200, SD 2/4) đang vận hành trong một Panel. */
function qc(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, admin);
  const config = createConfigHandlers(db);
  const instrument = must(config.saveInstrument({ data: { name: 'Máy kiểm tra' } }, admin));
  const assay = must(config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin));
  const lots = [];
  for (const [level, mean, sd] of [[1, 100, 2], [2, 200, 4]]) {
    const lot = must(config.saveLot({ data: { lotNo: `REVIEW-L${level}`, level } }, admin)); lots.push(lot);
    must(config.saveTestLevel({ testId: assay.id, data: { level, mean, sd, qcLotId: lot.id } }, admin));
  }
  const operation = makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: lots.map((lot, i) => ({ level: i + 1, lotId: lot.id })) });
  const entry = createEntryHandlers(db), report = createReportHandlers(db);
  const add = (level, date, val) => must(entry.addPoint({ data: { testId: assay.id, level, date, val, runId: `${date}-1` } }, admin));
  return { db, config, instrument, assay, entry, report, add, operation };
}

test('R01: dừng nhóm lô không đổi kết luận của biên bản tháng', (t) => {
  const f = qc(t);
  f.add(1, '2026-10-01', 108); f.add(2, '2026-10-01', 200);
  const before = f.report.getQcMonthlyReview('2026-10').totals;
  assert.equal(before.rejected_runs, 1);
  // Lần chạy bị loại đã được tiếp nhận thì mới dừng được nhóm lô (R03).
  createIqcNce(createNceHandlers(f.db), admin, f.assay.id, { date: '2026-10-01', runId: '2026-10-01-1' });
  must(f.config.stopLotGroup({ id: f.operation.groupId }, admin));
  const after = f.report.getQcMonthlyReview('2026-10');
  assert.deepEqual({ ...after.totals, nce: 0, nce_open: 0 }, before, 'biên bản phải giữ kết luận như báo cáo chi tiết');
  assert.deepEqual(after.rows.map((row) => row.unevaluated), [0, 0]);
});

test('R03: đổi lô, dừng nhóm lô cũng không làm lần chạy chưa lập hồ sơ rời hàng chờ', (t) => {
  const f = qc(t);
  f.add(1, '2026-10-01', 108); f.add(2, '2026-10-01', 200);
  const stop = f.config.stopLotGroup({ id: f.operation.groupId }, admin);
  assert.equal(stop.ok, false); assert.equal(stop.error.code, 'pending-rejected-runs');
  const lot = must(f.config.saveLot({ data: { lotNo: 'NEW-1', level: 1 } }, admin));
  const change = f.config.saveTestLevel({ testId: f.assay.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lot.id } }, admin);
  assert.equal(change.ok, false); assert.equal(change.error.code, 'pending-rejected-runs');
  assert.equal(nceQueueRows(f.db).length, 1);
  // Sửa Mean/SD không đổi lô thì vẫn lưu bình thường.
  must(f.config.saveTestLevel({ testId: f.assay.id, data: { level: 2, mean: 200, sd: 5, qcLotId: f.db.prepare('SELECT qc_lot_id FROM test_levels WHERE test_id=? AND level=2').get(f.assay.id).qc_lot_id } }, admin));
  // Đã lập hồ sơ thì lần chạy được giữ qua snapshot, đổi lô được.
  createIqcNce(createNceHandlers(f.db), admin, f.assay.id, { date: '2026-10-01', runId: '2026-10-01-1' });
  must(f.config.saveTestLevel({ testId: f.assay.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lot.id } }, admin));
  assert.equal(nceQueueRows(f.db).length, 1);
});

test('R02: mẫu khác của cùng máy là bổ sung, chỉ đúng mẫu đã có mới bị thay', (t) => {
  const f = qc(t), eqa = createEqaHandlers(f.db);
  const round = { program: 'VEQAS REVIEW', provider: 'TTKCXN', programCode: 'BC20C', unitCode: 'REVIEW', year: 2026, round: 'ĐỢT 09', reportCode: 'R-09', reportDate: '2026-10-20', assignedLevel: '' };
  const draft = (sample, z, extra = {}) => ({ data: { round, rows: [{ ref: sample, code: 'Glucose', instrument: 'Máy kiểm tra', sample, unit: 'mmol/L', result: 100 + z * 2, assigned: 100, sigmaP: 2, zProvider: z, method: '', peerGroup: '', peer: {} }],
    mappings: [{ code: 'Glucose', instrument: 'Máy kiểm tra', testId: f.assay.id }], source: 'pdf', sourceName: `${sample}.pdf`, ...extra } });
  const first = must(eqa.importEqaRound(draft('09-01', 3.2), admin));
  // Mẫu thứ hai không phải lần thay nên không cần lý do.
  const second = must(eqa.importEqaRound(draft('09-02', 0.5, { expectedVersion: first.round.row_version }), admin));
  assert.deepEqual(second.results.map((row) => row.sample).sort(), ['09-01', '09-02']);
  assert.equal(eqa.listEqaAttention().length, 1, 'mẫu z = 3,2 vẫn trong "Cần chú ý"');
  // Nhập lại đúng mẫu 09-01 là thay: cần lý do, và mẫu 09-02 được giữ.
  const replace = eqa.importEqaRound(draft('09-01', 0.4, { expectedVersion: second.round.row_version }), admin);
  assert.equal(replace.ok, false); assert.equal(replace.error.code, 'replace-reason');
  const replaced = must(eqa.importEqaRound(draft('09-01', 0.4, { replaceReason: 'Nhập sai giá trị mẫu 09-01', expectedVersion: second.round.row_version }), admin));
  assert.deepEqual(replaced.results.map((row) => [row.sample, row.z_official]).sort(), [['09-01', 0.4], ['09-02', 0.5]]);
});

test('R03: không tắt Panel khi còn lần chạy bị loại chưa lập hồ sơ NCE', (t) => {
  const f = qc(t);
  f.add(1, '2026-10-01', 108); f.add(2, '2026-10-01', 200);
  assert.equal(nceQueueRows(f.db).length, 1);
  const panel = { name: 'Panel ngừng hoạt động', instrumentId: f.instrument.id, active: false, testIds: [f.assay.id] };
  const off = f.config.savePanel({ id: f.operation.panelId, data: panel }, admin);
  assert.equal(off.ok, false); assert.equal(off.error.code, 'pending-rejected-runs');
  assert.match(off.error.message, /Glucose 01\/10\/2026/);
  assert.equal(nceQueueRows(f.db).length, 1, 'lần lưu bị huỷ, hàng chờ còn nguyên');
  const stop = f.config.saveTest({ id: f.assay.id, data: { name: 'Glucose', instrumentId: f.instrument.id, active: false } }, admin);
  assert.equal(stop.ok, false); assert.equal(stop.error.code, 'pending-rejected-runs');
});

test('R03: Panel không còn việc tồn thì tắt bình thường', (t) => {
  const f = qc(t);
  f.add(1, '2026-10-01', 100); f.add(2, '2026-10-01', 200);
  must(f.config.savePanel({ id: f.operation.panelId, data: { name: 'Panel ngừng hoạt động', instrumentId: f.instrument.id, active: false, testIds: [f.assay.id] } }, admin));
});

test('R04: số liệu đổi sau khi ký thì chữ ký cũ không còn dùng để khoá kỳ', (t) => {
  const f = qc(t);
  f.add(1, '2026-10-01', 100); f.add(2, '2026-10-01', 200);
  must(f.report.signQcMonthlyReview({ data: { ym: '2026-10', conclusion: 'ok', note: '' } }, admin));
  assert.equal(f.report.getQcMonthlyReview('2026-10').signature_stale, false);
  f.add(1, '2026-10-02', 101); f.add(2, '2026-10-02', 201);
  assert.equal(f.report.getQcMonthlyReview('2026-10').signature_stale, true);
  const lock = f.report.lockPeriod({ data: { ym: '2026-10' } }, admin);
  assert.equal(lock.ok, false); assert.equal(lock.error.code, 'period-open-items');
  assert.match(lock.error.message, /cần ký lại/);
  must(f.report.signQcMonthlyReview({ data: { ym: '2026-10', conclusion: 'ok', note: '' } }, admin));
  assert.equal(f.report.getQcMonthlyReview('2026-10').signature_stale, false);
  must(f.report.lockPeriod({ data: { ym: '2026-10' } }, admin));
});

test('R04: dấu vân tay bỏ qua tên và hồ sơ NCE, bắt thay đổi số liệu', () => {
  const row = { test_id: 't', test_name: 'Glucose', level: 1, lot: 'L1', n: 2, accepted: 2, rejected: 0, unevaluated: 0, mean: 100.1, sd: 0.2, target_mean: 100, target_sd: 2, voided: 0, voided_rejected: 0 };
  const base = reviewDataFingerprint({ rows: [row], totals: { rejected_runs: 0, nce: 0 } });
  assert.equal(reviewDataFingerprint({ rows: [{ ...row, test_name: 'Glucose (đổi tên)' }], totals: { rejected_runs: 0, nce: 3 } }), base);
  assert.notEqual(reviewDataFingerprint({ rows: [{ ...row, n: 3 }], totals: { rejected_runs: 0 } }), base);
  assert.notEqual(reviewDataFingerprint({ rows: [row], totals: { rejected_runs: 1 } }), base);
});

test('R05: huỷ điểm lô cũ thuộc lần chạy bị loại theo R4s cần lý do và giữ bằng chứng', (t) => {
  const f = qc(t);
  const point = f.add(1, '2026-10-01', 105); f.add(2, '2026-10-01', 190);
  assert.ok(f.entry.queryPoints(f.assay.id, 1)[0].rules.includes('R4s'));
  // Lần chạy bị loại phải được tiếp nhận trước khi đổi lô (R03).
  createIqcNce(createNceHandlers(f.db), admin, f.assay.id, { date: '2026-10-01', runId: '2026-10-01-1' });
  for (const level of [1, 2]) {
    const lot = must(f.config.saveLot({ data: { lotNo: `NEW-${level}`, level } }, admin));
    must(f.config.saveTestLevel({ testId: f.assay.id, data: { level, mean: level === 1 ? 100 : 200, sd: level === 1 ? 2 : 4, qcLotId: lot.id } }, admin));
  }
  const blank = f.entry.voidPoint({ data: { pointId: point.id, kind: 'data-entry', reason: '' } }, admin);
  assert.equal(blank.ok, false); assert.equal(blank.error.code, 'reason-required-rejected-run');
  must(f.entry.voidPoint({ data: { pointId: point.id, kind: 'data-entry', reason: 'Gõ nhầm giá trị, đối chiếu phiếu in của máy' } }, admin));
  const evidence = JSON.parse(f.db.prepare('SELECT void_rejection_json FROM qc_points WHERE id=?').get(point.id).void_rejection_json);
  assert.ok(evidence.rules.includes('R4s'));
});

test('R06: không khoá kỳ chưa tới; tháng hiện tại và tháng đã qua vẫn khoá được', () => {
  const today = '2026-11-10';
  const future = validateLockPeriod({ ym: '2027-03', acknowledge: true }, today);
  assert.equal(future.ok, false); assert.equal(future.code, 'future-period');
  assert.equal(validateLockPeriod({ ym: '2026-12' }, today).ok, false);
  assert.equal(validateLockPeriod({ ym: '2026-11' }, today).ok, true);
  assert.equal(validateLockPeriod({ ym: '2026-10' }, today).ok, true);
});
