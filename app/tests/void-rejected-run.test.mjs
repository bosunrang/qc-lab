// Huỷ điểm thuộc lần chạy bị loại (N4 của đánh giá 2026-10-31; ISO 15189:2022
// 7.3.7.2, 8.4): mọi loại huỷ — kể cả "nhập sai dữ liệu" — cần lý do ≥ 10 ký
// tự, và điểm đã huỷ giữ bằng chứng lần chạy bị loại. Loại "nhập sai dữ liệu"
// vẫn không mở NCE.
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
const { voidReasonMinimum, REJECTED_RUN_VOID_REASON_MIN } = require('../../app-dist/main/domain/entry-validation.js');

const tech = { userId: 'u-tech', username: 'ktv', name: 'KTV', role: 'technician', clientId: 't' };
const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };

/** Xét nghiệm 2 mức, Mean 100/200, SD 2/4; vài lần chạy đạt rồi một lần chạy
 * mà Mức 1 vượt +3,5SD (1-3s), Mức 2 đạt. */
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
  const add = (level, date, val) => {
    const result = entry.addPoint({ data: { testId: assay.id, level, date, runId: `${date}-1`, val } }, tech);
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data.id;
  };
  for (const day of ['2026-09-01', '2026-09-02']) { add(1, day, 100.5); add(2, day, 199); }
  const failing = add(1, '2026-09-03', 107);
  const sibling = add(2, '2026-09-03', 201);
  const clean = add(1, '2026-09-04', 100.4);
  const row = (id) => db.prepare('SELECT voided, void_rejection_json FROM qc_points WHERE id=?').get(id);
  const nceCount = () => db.prepare('SELECT COUNT(*) AS n FROM nce_records').get().n;
  return { db, entry, failing, sibling, clean, row, nceCount };
}

const voidAs = (entry, pointId, kind, reason) => entry.voidPoint({ data: { pointId, kind, reason } }, tech);

test('huỷ "nhập sai dữ liệu" điểm Loại bỏ: bắt buộc lý do ≥ 10 ký tự, không mở NCE, giữ bằng chứng', (t) => {
  const { db, entry, failing, row, nceCount } = fixture(t);
  assert.equal(voidAs(entry, failing, 'data-entry', '').error.code, 'reason-required-rejected-run');
  assert.equal(voidAs(entry, failing, 'data-entry', 'Gõ nhầm').error.code, 'reason-required-rejected-run');
  assert.equal(row(failing).voided, 0, 'bị từ chối thì chưa huỷ');

  const done = voidAs(entry, failing, 'data-entry', 'Gõ nhầm 107 thay cho 101, đối chiếu phiếu in máy');
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.equal(done.data.nceId, null, 'nhập sai dữ liệu vẫn không mở NCE');
  assert.equal(nceCount(), 0);
  const evidence = JSON.parse(row(failing).void_rejection_json);
  assert.deepEqual(evidence.rules, ['1-3s']);
  const audit = listActivity(db, 1)[0];
  assert.equal(audit.type, 'Hủy điểm QC');
  assert.match(audit.detail, /Thuộc lần chạy 2026-09-03-1 bị loại \(luật 1-3s\)/);
});

test('mức đạt nhưng cùng lần chạy bị loại cũng cần lý do; bằng chứng ghi mức vi phạm', (t) => {
  const { entry, sibling, row } = fixture(t);
  assert.equal(voidAs(entry, sibling, 'analytical', '').error.code, 'reason-required-rejected-run');
  const done = voidAs(entry, sibling, 'analytical', 'Cuvette mức 2 bị bọt, đã ghi sổ máy');
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.deepEqual(JSON.parse(row(sibling).void_rejection_json), { rules: [], rejectedLevels: [1] });
});

test('lần chạy đạt: giữ quy tắc cũ — "nhập sai dữ liệu" không bắt lý do, không ghi bằng chứng', (t) => {
  const { entry, clean, row } = fixture(t);
  assert.equal(voidAs(entry, clean, 'data-entry', '').ok, true);
  assert.equal(row(clean).void_rejection_json, '');
});

test('ngưỡng lý do theo loại huỷ và lần chạy', () => {
  assert.equal(REJECTED_RUN_VOID_REASON_MIN, 10);
  assert.equal(voidReasonMinimum('data-entry', false), 0);
  assert.equal(voidReasonMinimum('analytical', false), 0);
  assert.equal(voidReasonMinimum('other', false), 5);
  for (const kind of ['data-entry', 'analytical', 'other']) assert.equal(voidReasonMinimum(kind, true), 10, kind);
});
