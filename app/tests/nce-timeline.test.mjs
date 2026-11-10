// Dòng thời gian tự dựng và bản nháp phạm vi kiểm soát của hồ sơ NCE (quyết
// định 10/11/2026): người dùng không phải gõ lại các mốc app đã lưu, ô "Ghi
// thêm về diễn biến" không còn là cổng; phạm vi kiểm soát vẫn bắt buộc và
// chặn khi còn chỗ trống `[cần ghi]` của bản nháp.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { ensureUser, must } from './helpers/nce-flow.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { nceTimeline } = require('../../app-dist/main/domain/nce/timeline.js');
const { nceContainmentDraft, NCE_DRAFT_BLANK } = require('../../app-dist/main/domain/nce/containment-draft.js');

const admin = { userId: 'u-admin', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 't' };

test('hàm thuần: sắp mốc theo thời gian, mốc chỉ có ngày đứng đầu ngày, bỏ loại quyết định lạ', () => {
  const at = (h, m) => new Date(2026, 10, 10, h, m).toISOString();
  const entries = nceTimeline({
    detectedAt: '2026-11-10', createdAt: at(7, 18), reportedBy: 'An',
    onset: { date: '2026-11-09', runId: '2026-11-09-2' }, onsetRules: ['2-2s'],
    trigger: { date: '2026-11-10', runId: '2026-11-10-1' },
    voids: [{ level: 1, at: at(7, 17), by: 'An' }],
    rerun: { date: '2026-11-10', runId: '2026-11-10-2' },
    decisions: [{ type: 'release', at: at(9, 0), actor: 'Bình' }, { type: 'khong-ro', at: at(8, 0), actor: 'X' }],
    actionsDone: [],
  });
  assert.deepEqual(entries.map((e) => e.label), [
    'Bắt đầu chuỗi vi phạm', 'Lần chạy QC bị loại', 'Phát hiện sự cố', 'Chạy lại QC', 'Huỷ điểm QC mức 1', 'Lập hồ sơ', 'Cho phép hoạt động trở lại',
  ]);
  assert.equal(entries[0].detail, 'lần 2026-11-09-2 · luật 2-2s', 'cột thời gian đã có ngày, chi tiết không lặp');
  assert.deepEqual(entries[1].run, { date: '2026-11-10', runId: '2026-11-10-1' }, 'mốc bị loại gắn lần chạy để mở bảng điểm');
});

test('hàm thuần: bản nháp phạm vi ghi xét nghiệm, máy, lô, khoảng nghi ngờ và chừa chỗ người làm ghi', () => {
  const draft = nceContainmentDraft({
    testName: 'Glucose', instrumentName: 'Máy A', lots: [{ level: 2, lot: 'L2' }, { level: 1, lot: 'L1' }],
    lastAccepted: { date: '2026-11-08', runId: 'a' }, onset: { date: '2026-11-09', runId: 'b' }, trigger: { date: '2026-11-10', runId: 'c' },
  });
  assert.match(draft, /^Xét nghiệm Glucose trên máy Máy A; lô QC: M1 L1, M2 L2\./);
  assert.match(draft, /từ lần chạy 09\/11\/2026 · lần b đến lần chạy 10\/11\/2026 · lần c \(lần chạy đạt gần nhất trước đó: 08\/11\/2026 · lần a\)/);
  assert.equal(draft.split(NCE_DRAFT_BLANK).length - 1, 2, 'hai chỗ trống: giữ kết quả từ lúc nào, đã báo cho ai');
});

test('hồ sơ mở khi huỷ điểm: có dòng thời gian, bản nháp; cổng không đòi diễn biến nhưng chặn chỗ trống', (t) => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  ensureUser(db, admin);
  const config = createConfigHandlers(db), entry = createEntryHandlers(db), nce = createNceHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, admin).data;
  config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 100, sd: 2 } }, admin);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1, lotNo: 'LOT-1' }] });
  const point = must(entry.addPoint({ data: { testId: assay.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', val: 107 } }, admin), 'điểm 1-3s');
  const voided = must(entry.voidPoint({ data: { pointId: point.id, kind: 'analytical', reason: 'Bọt khí trong cuvette', openNce: true } }, admin), 'huỷ và mở hồ sơ');
  const id = db.prepare('SELECT id FROM nce_records WHERE nce_id=?').get(voided.nceId).id;

  let view = nce.getNce(id, admin);
  const labels = view.timeline.map((e) => e.label);
  for (const label of ['Lần chạy QC bị loại', 'Huỷ điểm QC mức 1', 'Phát hiện sự cố', 'Lập hồ sơ']) assert.ok(labels.includes(label), `có mốc ${label}: ${labels}`);
  assert.ok(view.timeline.find((e) => e.label === 'Huỷ điểm QC mức 1').detail, 'ghi người huỷ');
  assert.match(view.containment_draft, /Xét nghiệm Glucose trên máy Máy A; lô QC: M1 LOT-1\./);
  assert.ok(!view.missing.some((m) => m.code === 'occurred'), 'không còn bắt gõ diễn biến');

  view = must(nce.updateNce({ data: { id, expectedVersion: view.record.row_version, patch: { containmentNote: view.containment_draft } } }, admin), 'lưu bản nháp');
  assert.ok(view.missing.some((m) => m.code === 'containment-blank'), 'còn [cần ghi] thì chưa qua cổng');
  const filled = view.containment_draft.replace(NCE_DRAFT_BLANK, '08:15 10/11/2026').replace(NCE_DRAFT_BLANK, 'trưởng khoa lúc 08:20');
  view = must(nce.updateNce({ data: { id, expectedVersion: view.record.row_version, patch: { containmentNote: filled } } }, admin), 'bổ sung');
  assert.ok(!view.missing.some((m) => m.code.startsWith('containment')), 'đã bổ sung đủ');
});
