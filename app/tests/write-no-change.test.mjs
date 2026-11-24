// Các nhánh "lưu mà không có gì đổi" của thao tác ghi: phải trả thành công
// qua `w.noChange()` — không nhật ký, không báo renderer, không ném lỗi của
// cổng ghi. Trước khi có test này, một nhánh như vậy mà quên `w.noChange()`
// chỉ lộ ra khi người dùng bấm Lưu lần thứ hai (lỗi "internal-error").
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createReagentHandlers } = require('../../app-dist/main/ipc/reagent-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { createAuditHandlers } = require('../../app-dist/main/ipc/audit-handlers.js');
const { addChangeListener } = require('../../app-dist/main/ipc/shared.js');

const admin = { userId: 'u1', username: 'admin', name: 'Quản trị', role: 'admin', clientId: 'test' };

function setup() {
  const db = openDatabase(':memory:');
  const handlers = {
    config: createConfigHandlers(db), reagent: createReagentHandlers(db),
    sigma: createSigmaHandlers(db), audit: createAuditHandlers(db),
  };
  const auditCount = () => db.prepare('SELECT COUNT(*) AS n FROM activity').get().n;
  return { db, ...handlers, auditCount };
}

/** Chạy `work` và kiểm: thành công, không thêm dòng nhật ký, không báo gì. */
function expectNoChange(ctx, label, work) {
  const events = [];
  const stop = addChangeListener((payload) => events.push(payload));
  const before = ctx.auditCount();
  let result;
  try { result = work(); } finally { stop(); }
  assert.equal(result?.ok, true, `${label}: ${JSON.stringify(result?.error)}`);
  assert.equal(ctx.auditCount(), before, `${label}: không ghi nhật ký`);
  assert.deepEqual(events, [], `${label}: không báo renderer`);
  return result.data;
}

test('So sánh hoá chất: lưu lại đúng dữ liệu cũ, thêm giá trị chọn nhanh đã có', () => {
  const ctx = setup();
  const created = ctx.reagent.createComparison({ data: { name: 'Glucose', unit: 'mmol/L' } }, admin).data;
  assert.equal(ctx.reagent.saveMetadata({ id: created.id, data: { operator: 'KTV A' } }, admin).ok, true);
  expectNoChange(ctx, 'saveMetadata giữ nguyên', () => ctx.reagent.saveMetadata({ id: created.id, data: { operator: 'KTV A' } }, admin));
  expectNoChange(ctx, 'saveRows giữ nguyên', () => ctx.reagent.saveRows({ id: created.id, rows: created.rows }, admin));
  assert.equal(ctx.reagent.addQuickListValue({ type: 'operator', value: 'KTV B' }, admin).ok, true);
  expectNoChange(ctx, 'addQuickListValue đã có', () => ctx.reagent.addQuickListValue({ type: 'operator', value: 'KTV B' }, admin));
});

test('TEa: bỏ ghi đè chưa từng có, khôi phục analyte chưa có, xoá hồ sơ PXN chưa có', () => {
  const ctx = setup();
  expectNoChange(ctx, 'setTeaRefValue bỏ giá trị chưa có', () => ctx.config.setTeaRefValue({ analyteId: 'khong-co', field: 'clia', value: '' }, admin));
  expectNoChange(ctx, 'restoreTeaRefDefaults chưa có', () => ctx.config.restoreTeaRefDefaults({ analyteId: 'khong-co' }, admin));
  assert.equal(ctx.config.setTeaRefValue({ analyteId: 'glu', field: 'clia', value: '10', name: 'Glucose' }, admin).ok, true);
  const row = ctx.db.prepare("SELECT id FROM tea_refs WHERE analyte_id='glu'").get();
  const data = expectNoChange(ctx, 'removeTeaLabProfile khi chưa có hồ sơ PXN', () => ctx.config.removeTeaLabProfile({ id: row.id }, admin));
  assert.equal(data.removedRecord, false);
});

test('Six Sigma: đổi kỳ sang đúng kỳ hiện tại', () => {
  const ctx = setup();
  const instrument = ctx.config.saveInstrument({ data: { name: 'Máy A' } }, admin).data;
  const t = ctx.config.saveTest({ data: { name: 'Ure', instrumentId: instrument.id, unit: 'mmol/L' } }, admin).data;
  const period = ctx.sigma.savePeriod({ testId: t.id, period: '2026-01', tea: 10, levels: [{ level: 1, cv: 3 }] }, admin).data;
  const data = expectNoChange(ctx, 'renamePeriod cùng kỳ', () => ctx.sigma.renamePeriod({ id: period.id, period: '2026-01' }, admin));
  assert.equal(data.period, '2026-01');
});

test('Lưu trữ nhật ký khi chưa có dòng nào đủ cũ; Mean/SD dự kiến chỉ bỏ mục không tồn tại', () => {
  const ctx = setup();
  ctx.config.saveInstrument({ data: { name: 'Máy B' } }, admin);
  const archived = expectNoChange(ctx, 'archive không có gì để gỡ', () => ctx.audit.archive({ data: { months: 12 } }, admin));
  assert.equal(archived.removedCount, 0);
  const planned = expectNoChange(ctx, 'savePlannedTargets bỏ mục không tồn tại', () => ctx.config.savePlannedTargets({ remove: [{ testId: 'khong-co', level: 1, qcLotId: 'khong-co' }] }, admin));
  assert.deepEqual(planned, { saved: 0, removed: 0 });
});

test('Nhập QC: rời ô ghi chú mà không sửa gì, kể cả khi tháng đã khoá', () => {
  const ctx = setup();
  const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
  const entry = createEntryHandlers(ctx.db);
  const instrument = ctx.config.saveInstrument({ data: { name: 'Máy C' } }, admin).data;
  const t = ctx.config.saveTest({ data: { name: 'Glucose ghi chú', instrumentId: instrument.id } }, admin).data;
  ctx.config.saveTestLevel({ testId: t.id, data: { level: 1, mean: 10, sd: 1 } }, admin);
  makeOperationalQc(ctx.db, { testId: t.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });
  assert.equal(entry.addPoint({ data: { testId: t.id, level: 1, date: '2026-08-03', val: 10.2 } }, admin).ok, true);
  assert.equal(entry.setDayNote({ data: { testId: t.id, date: '2026-08-03', note: 'Thay cuvette' } }, admin).ok, true);
  expectNoChange(ctx, 'setDayNote cùng ghi chú', () => entry.setDayNote({ data: { testId: t.id, date: '2026-08-03', note: '  Thay cuvette ' } }, admin));
  ctx.db.prepare("INSERT INTO period_locks(id,ym,locked_at,locked_by,note) VALUES ('lock-08','2026-08','2026-09-01T00:00:00Z','admin','')").run();
  expectNoChange(ctx, 'setDayNote cùng ghi chú ở tháng đã khoá', () => entry.setDayNote({ data: { testId: t.id, date: '2026-08-03', note: 'Thay cuvette' } }, admin));
  assert.equal(entry.setDayNote({ data: { testId: t.id, date: '2026-08-03', note: 'Khác' } }, admin).error?.code, 'period-locked', 'sửa thật ở tháng khoá vẫn bị chặn');
});

test('Six Sigma: rời ô EFLM mà không sửa gì', () => {
  const ctx = setup();
  const instrument = ctx.config.saveInstrument({ data: { name: 'Máy D' } }, admin).data;
  const t = ctx.config.saveTest({ data: { name: 'Cholesterol', instrumentId: instrument.id } }, admin).data;
  assert.equal(ctx.sigma.saveTeaConfig({ testId: t.id, source: 'eflm', tea: 8, eflmAnalyte: 'Cholesterol', eflmRef: 'EFLM' }, admin).ok, true);
  expectNoChange(ctx, 'saveTeaConfig cùng giá trị', () => ctx.sigma.saveTeaConfig({ testId: t.id, source: 'eflm', eflmAnalyte: 'Cholesterol' }, admin));
  expectNoChange(ctx, 'saveTeaConfig cùng link', () => ctx.sigma.saveTeaConfig({ testId: t.id, source: 'eflm', eflmRef: 'EFLM' }, admin));
});
