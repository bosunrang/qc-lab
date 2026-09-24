// Cột `actions.error_type` chỉ được chứa MÃ `SE` / `RE` / `''`.
//
// "SE — Sai số hệ thống", luồng quản lý dải ghi "Quản lý dải kiểm soát"; mà
// trang Hành động so `=== 'SE'` nên hai nguồn sau hiện NGƯỢC thành "Sai số
// ngẫu nhiên". File này khóa hằng nhãn, cổng ghi, chuẩn hóa dữ liệu và hiển thị.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema } = require('../../app-dist/main/db/schema.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createNceHandlers } = require('../../app-dist/main/ipc/nce-handlers.js');
const { ERROR_CLASS_LABEL, errorClass, errorType, normalizeErrorClass } = require('../../app-dist/main/domain/westgard-rules.js');

const actor = { userId: 'u1', username: 'admin', name: 'Quản trị viên', role: 'admin', clientId: 'test-client' };
const CODES = new Set(['SE', 'RE', '']);

test('nhãn hiển thị và mã lưu trữ chung một nguồn', () => {
  assert.deepEqual(ERROR_CLASS_LABEL, { SE: 'SE — Sai số hệ thống', RE: 'RE — Sai số ngẫu nhiên', '': '—' });
  assert.equal(errorType(['2-2s']), ERROR_CLASS_LABEL.SE);
  assert.equal(errorType(['1-3s']), ERROR_CLASS_LABEL.RE);
  assert.equal(errorType(['1-2s']), ERROR_CLASS_LABEL['']);
  assert.equal(errorClass(['9x']), 'SE');
  for (const [raw, want] of [
    ['SE', 'SE'], ['RE', 'RE'], ['', ''],
    ['SE — Sai số hệ thống', 'SE'], ['RE — Sai số ngẫu nhiên', 'RE'],
    ['Quản lý dải kiểm soát', ''], ['—', ''], [null, ''], [undefined, ''],
  ]) assert.equal(normalizeErrorClass(raw), want, `normalizeErrorClass(${JSON.stringify(raw)})`);
});

test('applySchema dọn dữ liệu cũ về mã chuẩn và chạy lại được nhiều lần', t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const insert = db.prepare("INSERT INTO actions(id,date,nce_id,error_type) VALUES (?,?,?,?)");
  const rawErrorTypes = [
    ['a1', 'SE — Sai số hệ thống', 'SE'],
    ['a2', 'RE — Sai số ngẫu nhiên', 'RE'],
    ['a3', 'Quản lý dải kiểm soát', ''],
    ['a4', 'se — sai số hệ thống', 'SE'],
    ['a5', '—', ''],
    ['a6', 'SE', 'SE'],
    ['a7', '', ''],
  ];
  for (const [id, raw] of rawErrorTypes) insert.run(id, '2026-09-01', `NCE-${id}`, raw);
  applySchema(db);
  const read = () => Object.fromEntries((db.prepare('SELECT id,error_type FROM actions').all()).map(r => [r.id, r.error_type]));
  const after = read();
  for (const [id, raw, want] of rawErrorTypes) assert.equal(after[id], want, `${id}: "${raw}" → "${want}"`);
  // Phép ánh xạ SQL phải cho cùng kết quả với `normalizeErrorClass()`.
  for (const [id, raw] of rawErrorTypes) assert.equal(after[id], normalizeErrorClass(raw), `${id}: SQL lệch normalizeErrorClass()`);
  applySchema(db);
  assert.deepEqual(read(), after, 'chạy lại không đổi gì thêm');
});

test('mọi cổng ghi chỉ lưu mã SE/RE/rỗng', t => {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const config = createConfigHandlers(db);
  const entry = createEntryHandlers(db);
  const nce = createNceHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Máy A' } }, actor).data;
  const assay = config.saveTest({ data: { name: 'Glucose', instrumentId: instrument.id } }, actor).data;
  assert.equal(config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 100, sd: 2 } }, actor).ok, true);
  makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

  // 1. Huỷ điểm vi phạm 1-3s và mở NCE kèm theo.
  const point = entry.addPoint({ data: { testId: assay.id, level: 1, date: '2026-09-02', runId: '2026-09-02-1', val: 107 } }, actor);
  assert.equal(point.ok, true, JSON.stringify(point));
  assert.equal(point.data.verdict, 'rej');
  const voided = entry.voidPoint({ data: { pointId: point.data.id, kind: 'analytical', reason: 'Bọt khí trong cuvette', openNce: true } }, actor);
  assert.equal(voided.ok, true, JSON.stringify(voided));
  assert.equal(db.prepare('SELECT error_type FROM actions WHERE point_id=?').get(point.data.id).error_type, 'RE');

  // 2. Hồ sơ quản lý dải: hoàn dải nhà sản xuất → KHÔNG phân loại sai số.
  db.prepare("UPDATE test_levels SET applied='lab', mfg_mean=100, mfg_sd=2 WHERE test_id=? AND level=1").run(assay.id);
  const reverted = entry.revertManufacturerRange({ data: { testId: assay.id, level: 1, reason: 'Hoàn dải theo SOP để đối chiếu' } }, actor);
  assert.equal(reverted.ok, true, JSON.stringify(reverted));
  const rangeRow = db.prepare("SELECT error_type,rule,detail_json FROM actions WHERE detail_json LIKE '%rangeWorkflow%'").get();
  assert.equal(rangeRow.error_type, '', 'hồ sơ quản lý dải không có loại sai số');
  assert.equal(rangeRow.rule, 'Hoàn dải QC', 'loại việc nằm ở cột `rule`, không nhét vào `error_type`');

  // 3. Form NCE nhận chuỗi dài từ client cũ → vẫn lưu về mã.
  const created = nce.create({ data: {
    testId: assay.id, level: 1, lot: 'L1', date: '2026-09-03', rule: '2-2s',
    errorType: 'SE — Sai số hệ thống', correction: 'Hiệu chuẩn lại và chạy lại QC', dueDate: '2026-09-10',
  } }, actor);
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(db.prepare('SELECT error_type FROM actions WHERE id=?').get(created.data.id).error_type, 'SE');

  const stored = db.prepare('SELECT DISTINCT error_type FROM actions').all().map(r => r.error_type);
  assert.ok(stored.every(value => CODES.has(value)), `cột chỉ chứa mã: ${JSON.stringify(stored)}`);
});

test('các chỗ hiển thị đọc mã ra nhãn, không in giá trị thô', () => {
  const actions = readFileSync(new URL('../renderer/pages/ActionsPage.tsx', import.meta.url), 'utf8');
  const report = readFileSync(new URL('../renderer/pages/ReportPage.tsx', import.meta.url), 'utf8');
  const westgard = readFileSync(new URL('../main/ipc/westgard-handlers.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(actions, /\{record\.error_type \|\| '—'\}/, 'hộp thoại duyệt phải in nhãn');
  assert.match(actions, /errorClassLabel\(record\.error_type\)/);
  assert.match(actions, /normalizeErrorClass\(record\.error_type\), detail\.correction/, 'CSV xuất mã đã chuẩn hoá');
  assert.match(report, /ERROR_CLASS_LABEL\[normalizeErrorClass\(r\.error_type\)\]/);
  // Bảng điểm Westgard: tín hiệu CUSUM phải cùng bộ từ vựng với luật thường,
  // không phải mã trần 'SE' bên cạnh "SE — Sai số hệ thống".
  assert.match(westgard, /cusumSignal \? ERROR_CLASS_LABEL\.SE : detail\.type/);
});


