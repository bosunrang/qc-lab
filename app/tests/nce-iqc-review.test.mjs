// Hồi quy đợt rà soát nghiệp vụ Khắc phục sự cố IQC ngày 17/11/2026
// (docs/NCE-REDESIGN-2026-10-12.md, mục "Rà soát 17/11/2026"). Dữ liệu giả lập
// trên SQLite bộ nhớ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must, releaseWith } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { nceQueueRows } = require('../../app-dist/main/db/nce-evaluation.js');

const admin = { userId: 'a', username: 'a', name: 'Quản trị thử', role: 'admin', clientId: 'test' };
const ref = (view) => ({ id: view.record.id, expectedVersion: view.record.row_version });
const trigger = { date: '2026-09-02', runId: '1' };

function setup() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  ensureUser(db, admin);
  const instrument = must(config.saveInstrument({ data: { name: 'Máy thử' } }, admin), 'máy');
  const assay = must(config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin), 'xét nghiệm');
  for (const level of [1, 2]) must(config.saveTestLevel({ testId: assay.id, data: { level, mean: 100, sd: 2 } }, admin), 'mức');
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1 }, { level: 2 }] });
  const addRun = (date, runId, z1, z2) => {
    for (const [level, z] of [[1, z1], [2, z2]]) must(entry.addPoint({ data: { testId: assay.id, level, date, runId, val: 100 + 2 * z } }, admin), 'điểm');
  };
  const create = () => must(nce.createNce({ data: { source: 'iqc', testId: assay.id, trigger, detectedAt: trigger.date,
    description: 'QC bị loại cần xử lý', correction: 'Giữ kết quả và kiểm tra vật liệu', holdResults: true, ownerUserId: admin.userId } }, admin), 'tạo hồ sơ');
  return { db, nce, entry, addRun, create, testId: assay.id };
}

test('A1: QC vẫn bị loại sau xử lý tức thời mà chưa gắn hồ sơ thì không cho hoạt động trở lại', () => {
  const { db, nce, addRun, create } = setup();
  addRun('2026-09-01', '1', 0, 0);
  addRun(trigger.date, '1', 3.5, 0);
  addRun(trigger.date, '2', 3.6, 0);
  addRun('2026-09-03', '1', 0, 0);
  const dossier = create();
  const rerun = { date: '2026-09-03', runId: '1' };
  const preview = must(nce.previewNceRelease({ data: { id: dossier.record.id, rerun } }, admin), 'xem trước');
  assert.equal(preview.ok, false);
  assert.ok(preview.problems.some((p) => p.code === 'rerun-unattached-failure' && p.message.includes('02/09/2026 · lần 2')), JSON.stringify(preview.problems));
  assert.throws(() => releaseWith(nce, admin, dossier, rerun), /chưa gắn vào hồ sơ/);

  const latest = nce.getNce(dossier.record.id, admin);
  const attached = must(nce.attachNceRun({ data: { ...ref(latest), run: { date: trigger.date, runId: '2' } } }, admin), 'gắn lần hỏng');
  const released = releaseWith(nce, admin, attached, rerun);
  assert.equal(released.record.status, 'released');
  assert.ok(released.capa_triggers.some((t) => t.code === 'repeat'), 'lần hỏng lặp lại buộc tầng CAPA');
  assert.equal(nceQueueRows(db).filter((row) => !row.record).length, 0, 'không còn lần hỏng mồ côi trong hàng chờ');
});

test('A1: lần hỏng SAU ứng viên rerun vẫn chặn mốc cũ (15/10), không báo trùng thành "chưa gắn"', () => {
  const { nce, addRun, create } = setup();
  addRun('2026-09-01', '1', 0, 0);
  addRun(trigger.date, '1', 3.5, 0);
  addRun('2026-09-03', '1', 0, 0);
  addRun('2026-09-04', '1', -3.5, 0);
  const dossier = create();
  const preview = must(nce.previewNceRelease({ data: { id: dossier.record.id, rerun: { date: '2026-09-03', runId: '1' } } }, admin), 'xem trước');
  assert.deepEqual(preview.problems.map((p) => p.code), ['rerun-too-early']);
});

test('A2: chuyển sang tầng CAPA dời hạn mặc định theo cấu hình, giữ hạn đã chỉnh tay', () => {
  const { nce, addRun, create } = setup();
  addRun('2026-09-01', '1', 0, 0);
  addRun(trigger.date, '1', 3.5, 0);
  const dossier = create();
  assert.equal(dossier.record.due_date, '2026-09-09', 'hạn mặc định tầng xử lý nhanh 7 ngày');
  const capa = must(nce.updateNce({ data: { ...ref(dossier), patch: { tier: 'capa' } } }, admin), 'chuyển CAPA');
  assert.equal(capa.record.due_date, '2026-10-02', 'hạn CAPA 30 ngày từ ngày phát hiện');
  assert.ok(capa.revisions.some((r) => JSON.parse(r.changes_json).dueDate), 'lịch sử ghi lại việc dời hạn');

  const second = setup();
  second.addRun('2026-09-01', '1', 0, 0);
  second.addRun(trigger.date, '1', 3.5, 0);
  const manual = must(second.nce.updateNce({ data: { ...ref(second.create()), patch: { dueDate: '2026-09-20' } } }, admin), 'chỉnh hạn tay');
  const kept = must(second.nce.updateNce({ data: { ...ref(manual), patch: { tier: 'capa' } } }, admin), 'chuyển CAPA');
  assert.equal(kept.record.due_date, '2026-09-20', 'hạn người dùng đã chỉnh không bị ghi đè');
});

test('A3: huỷ điểm của lần rerun đã chốt cần lý do, báo ngay ở còn thiếu và cổng nộp duyệt', () => {
  const { db, nce, entry, addRun, create, testId } = setup();
  addRun('2026-09-01', '1', 0, 0);
  addRun(trigger.date, '1', 3.5, 0);
  addRun('2026-09-03', '1', 0, 0);
  const released = releaseWith(nce, admin, create(), { date: '2026-09-03', runId: '1' });
  const rerunPoint = db.prepare("SELECT id FROM qc_points WHERE test_id=? AND date='2026-09-03' AND level=2").get(testId);

  const noReason = entry.voidPoint({ data: { pointId: rerunPoint.id, reason: '', kind: 'data-entry', openNce: false } }, admin);
  assert.equal(noReason.ok, false);
  assert.equal(noReason.error.code, 'reason-required-rerun-evidence');
  assert.match(noReason.error.message, new RegExp(released.record.nce_id));
  must(entry.voidPoint({ data: { pointId: rerunPoint.id, reason: 'Nhập nhầm giá trị mức 2 của lần rerun', kind: 'data-entry', openNce: false } }, admin), 'huỷ điểm rerun');

  const view = nce.getNce(released.record.id, admin);
  assert.ok(view.missing.some((m) => m.code === 'recheck-rerun-missing-level'), JSON.stringify(view.missing.map((m) => m.code)));
  const submit = nce.submitNce({ data: ref(view) }, admin);
  assert.equal(submit.ok, false);
  assert.match(submit.error.message, /Bằng chứng rerun không còn hợp lệ/);

  // Nhập lại điểm của đúng lần chạy rerun thì bằng chứng hợp lệ trở lại.
  must(entry.addPoint({ data: { testId, level: 2, date: '2026-09-03', runId: '1', val: 100 } }, admin), 'nhập lại điểm');
  const fixed = nce.getNce(released.record.id, admin);
  assert.equal(fixed.missing.filter((m) => m.code.startsWith('recheck-')).length, 0);
});
