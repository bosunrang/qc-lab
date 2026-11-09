// Đổi dữ liệu không được âm thầm đổi kết luận của lần chạy đã có (N26–N28 của
// đợt rà soát 09/11/2026; ISO 15189:2022 7.3.7.2, 8.4; D-03 "không hồi tố").
// Luật nhiều lần chạy (2-2s…) nhìn lại lần chạy trước, nên:
// - huỷ điểm "bằng chứng" của hôm trước xoá được việc loại bỏ của hôm sau;
// - nhập lùi một điểm biến lần chạy đang Cảnh báo thành Loại bỏ.
// Đổi trạng thái loại bỏ của lần chạy khác cần lý do ≥10 ký tự và để lại bằng
// chứng; lần chạy đổi kết luận thuộc kỳ đã khoá thì chặn hẳn.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser } from './helpers/nce-flow.mjs';
import { listActivity } from './helpers/activity.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { changedRunConclusions, describeRunChange, flipsRejection, retroChangeError } = require('../../app-dist/main/domain/run-conclusion-change.js');

const tech = { userId: 'u-tech', username: 'ktv', name: 'KTV', role: 'technician', clientId: 't' };
const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };
const LONG_REASON = 'Gõ nhầm giá trị, đối chiếu phiếu in của máy';

/** Xét nghiệm 2 mức, Mean 100/200, SD 2/4, vài lần chạy đạt đầu tháng 9. */
function fixture(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, tech); ensureUser(db, admin);
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id, unit: 'mmol/L' } }, admin).data;
  const lot1 = config.saveLot({ data: { lotNo: 'L1', level: 1 } }, admin).data;
  const lot2 = config.saveLot({ data: { lotNo: 'L2', level: 2 } }, admin).data;
  assert.equal(config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 100, sd: 2, qcLotId: lot1.id } }, admin).ok, true);
  assert.equal(config.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 200, sd: 4, qcLotId: lot2.id } }, admin).ok, true);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1, lotId: lot1.id }, { level: 2, lotId: lot2.id }] });
  const entry = createEntryHandlers(db);
  const tryAdd = (level, date, val, retroReason) => entry.addPoint({ data: { testId: assay.id, level, date, runId: `${date}-1`, val, retroReason } }, tech);
  const add = (level, date, val) => {
    const result = tryAdd(level, date, val);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data;
  };
  for (const day of ['2026-09-01', '2026-09-02', '2026-09-03']) { add(1, day, 100.5); add(2, day, 199); }
  const verdictOf = (date) => entry.queryPoints(assay.id, 1).find((point) => point.date === date)?.verdict;
  const pointCount = () => db.prepare('SELECT COUNT(*) AS n FROM qc_points WHERE voided=0').get().n;
  const row = (id) => db.prepare('SELECT voided, void_rejection_json FROM qc_points WHERE id=?').get(id);
  const lock = (ym) => db.prepare('INSERT INTO period_locks(id,ym) VALUES (?,?)').run(`lock-${ym}`, ym);
  return { db, entry, testId: assay.id, add, tryAdd, verdictOf, pointCount, row, lock };
}

const voidAs = (entry, pointId, kind, reason) => entry.voidPoint({ data: { pointId, kind, reason } }, tech);

test('N26: huỷ điểm bằng chứng làm lần chạy sau hết bị loại — cần lý do, giữ bằng chứng', (t) => {
  const { db, entry, add, verdictOf, row } = fixture(t);
  const evidence = add(1, '2026-10-04', 105); add(2, '2026-10-04', 200);
  add(1, '2026-10-05', 105); add(2, '2026-10-05', 200);
  assert.equal(verdictOf('2026-10-05'), 'rej', '2-2s giữa hai lần chạy');

  const refused = voidAs(entry, evidence.id, 'data-entry', '');
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, 'reason-required-retro');
  assert.match(refused.error.message, /05\/10\/2026 lần chạy 1: Loại bỏ \(1-2s, 2-2s\) → Cảnh báo \(1-2s\)/);
  assert.equal(row(evidence.id).voided, 0, 'bị từ chối thì chưa huỷ');
  assert.equal(verdictOf('2026-10-05'), 'rej');

  const done = voidAs(entry, evidence.id, 'data-entry', LONG_REASON);
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.deepEqual(done.data.retroChanges.map((change) => [change.date, change.before, change.after]), [['2026-10-05', 'rej', 'warn']]);
  assert.equal(verdictOf('2026-10-05'), 'warn');
  const kept = JSON.parse(row(evidence.id).void_rejection_json);
  assert.deepEqual(kept.affectedRuns.map((change) => change.date), ['2026-10-05'], 'biên bản tháng còn đếm được điểm huỷ này');
  const audit = listActivity(db, 1)[0];
  assert.equal(audit.type, 'Huỷ điểm QC');
  assert.match(audit.detail, /Đổi kết luận lần chạy khác: 05\/10\/2026 lần chạy 1: Loại bỏ/);
});

test('N27: nhập lùi ngày làm lần chạy đã có thành Loại bỏ — cần lý do, báo lần chạy bị đổi', (t) => {
  const { db, add, tryAdd, verdictOf, pointCount } = fixture(t);
  add(1, '2026-10-06', 105); add(2, '2026-10-06', 200);
  assert.equal(verdictOf('2026-10-06'), 'warn');
  const before = pointCount();

  const refused = tryAdd(1, '2026-10-05', 105);
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, 'retro-reason-required');
  assert.match(refused.error.message, /06\/10\/2026 lần chạy 1: Cảnh báo \(1-2s\) → Loại bỏ/);
  assert.equal(pointCount(), before, 'bị từ chối thì không ghi điểm');
  assert.equal(tryAdd(1, '2026-10-05', 105, 'ngắn').error.code, 'retro-reason-required');

  const saved = tryAdd(1, '2026-10-05', 105, 'Bổ sung kết quả chạy ngày 05/10 bị sót');
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.deepEqual(saved.data.retroChanges.map((change) => [change.date, change.before, change.after]), [['2026-10-06', 'warn', 'rej']]);
  assert.equal(verdictOf('2026-10-06'), 'rej');
  const audit = listActivity(db, 1)[0];
  assert.equal(audit.type, 'Nhập QC');
  assert.match(audit.detail, /Đổi kết luận lần chạy khác: 06\/10\/2026.*Lý do: Bổ sung kết quả/);
});

test('N27: nhập lùi làm lần chạy đang bị loại hết bị loại cũng cần lý do', (t) => {
  const { entry, testId, add, verdictOf } = fixture(t);
  add(1, '2026-10-06', 105); add(2, '2026-10-06', 200);
  add(1, '2026-10-07', 105); add(2, '2026-10-07', 200);
  assert.equal(verdictOf('2026-10-07'), 'rej');
  // Lần chạy bổ sung ngày 06/10 đứng giữa hai lần chạy vượt 2SD → cắt chuỗi 2-2s.
  const between = (retroReason) => entry.addPoint({ data: { testId, level: 1, date: '2026-10-06', runId: '2026-10-06-2', val: 100, retroReason } }, tech);
  const refused = between(undefined);
  assert.equal(refused.ok, false);
  assert.equal(refused.error.code, 'retro-reason-required');
  assert.match(refused.error.message, /07\/10\/2026 lần chạy 1: Loại bỏ/);
  const saved = between('Bổ sung lần chạy lại sau hiệu chuẩn ngày 06/10');
  assert.equal(saved.ok, true, JSON.stringify(saved));
  assert.deepEqual(saved.data.retroChanges.map((change) => [change.date, change.before, change.after]), [['2026-10-07', 'rej', 'warn']]);
  assert.equal(verdictOf('2026-10-07'), 'warn');
});

test('nhập dần từng mức của cùng lần chạy và nhập theo thứ tự ngày không bị hỏi lý do', (t) => {
  const { add, verdictOf } = fixture(t);
  const first = add(1, '2026-10-04', 105);
  assert.deepEqual(first.retroChanges, []);
  const second = add(2, '2026-10-04', 200);
  assert.deepEqual(second.retroChanges, []);
  const third = add(1, '2026-10-05', 105);
  assert.deepEqual(third.retroChanges, [], 'lần chạy mới bị loại là kết luận của chính nó');
  assert.equal(verdictOf('2026-10-05'), 'rej');
});

test('N28: kỳ đã khoá không đổi kết luận — chặn cả huỷ điểm lẫn nhập lùi ở kỳ trước còn mở', (t) => {
  const { entry, testId, add, verdictOf, row, lock } = fixture(t);
  const evidence = add(1, '2026-09-30', 105); add(2, '2026-09-30', 200);
  add(1, '2026-10-01', 105); add(2, '2026-10-01', 200);
  assert.equal(verdictOf('2026-10-01'), 'rej');
  lock('2026-10');

  const voided = voidAs(entry, evidence.id, 'data-entry', LONG_REASON);
  assert.equal(voided.ok, false);
  assert.equal(voided.error.code, 'retro-locked');
  assert.match(voided.error.message, /2026-10/);
  assert.equal(row(evidence.id).voided, 0);
  assert.equal(verdictOf('2026-10-01'), 'rej');

  // Lần chạy bổ sung ngày 30/09 đứng sau lần chạy 1 nhưng trước 01/10: đổi
  // chuỗi 2-2s của lần chạy 01/10 (kỳ đã khoá) → chặn kể cả khi có lý do.
  const inserted = entry.addPoint({ data: { testId, level: 1, date: '2026-09-30', runId: '2026-09-30-2', val: 100, retroReason: LONG_REASON } }, tech);
  assert.equal(inserted.ok, false);
  assert.equal(inserted.error.code, 'retro-locked');
  assert.equal(verdictOf('2026-10-01'), 'rej');
});

test('hàm thuần: chỉ so lần chạy có ở cả hai phía, bỏ lần chạy của chính điểm', () => {
  const run = (date, verdict, rules = []) => ({ date, runId: `${date}-1`, verdict, rules });
  const key = (date) => `${date}\u0000${date}-1`;
  const before = new Map([[key('2026-10-01'), run('2026-10-01', 'warn', ['1-2s'])], [key('2026-10-02'), run('2026-10-02', 'rej', ['2-2s'])], [key('2026-10-03'), run('2026-10-03', 'ok')]]);
  const after = new Map([[key('2026-10-01'), run('2026-10-01', 'ok')], [key('2026-10-02'), run('2026-10-02', 'rej', ['2-2s'])], [key('2026-10-04'), run('2026-10-04', 'rej')]]);
  const changes = changedRunConclusions(before, after, new Set([key('2026-10-03')]));
  assert.deepEqual(changes.map((change) => change.date), ['2026-10-01']);
  assert.equal(flipsRejection(changes[0]), false);
  assert.equal(describeRunChange(changes[0]), '01/10/2026 lần chạy 1: Cảnh báo (1-2s) → Đạt');
  // Đạt ↔ Cảnh báo ở kỳ mở: không đòi lý do; ở kỳ khoá: chặn.
  assert.equal(retroChangeError(changes, () => false, '', 'Nhập điểm này', 'retro-reason-required'), null);
  assert.equal(retroChangeError(changes, () => true, LONG_REASON, 'Nhập điểm này', 'retro-reason-required').code, 'retro-locked');
});
