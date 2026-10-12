// Cột loại sai số (`actions.error_type` cũ, `nce_records.error_class` mới) chỉ
// được chứa MÃ `SE` / `RE` / `''`.
//
// "SE — Sai số hệ thống", luồng quản lý dải ghi "Quản lý dải kiểm soát"; mà
// trang Hành động so `=== 'SE'` nên hai nguồn sau hiện NGƯỢC thành "Sai số
// ngẫu nhiên". File này khóa hằng nhãn, cổng ghi, chuẩn hóa dữ liệu và hiển thị.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
import { createIqcNce, ensureUser } from './helpers/nce-flow.mjs';
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
  // Mô phỏng CSDL tạo trước bước migration 2: mỗi bước chỉ chạy một lần theo
  // số phiên bản, nên phải lùi số về 1 thì bước dọn dữ liệu mới chạy.
  const asVersion1 = () => db.prepare("UPDATE app_meta SET value='1' WHERE key='schemaVersion'").run();
  asVersion1();
  applySchema(db);
  const read = () => Object.fromEntries((db.prepare('SELECT id,error_type FROM actions').all()).map(r => [r.id, r.error_type]));
  const after = read();
  for (const [id, raw, want] of rawErrorTypes) assert.equal(after[id], want, `${id}: "${raw}" → "${want}"`);
  // Phép ánh xạ SQL phải cho cùng kết quả với `normalizeErrorClass()`.
  for (const [id, raw] of rawErrorTypes) assert.equal(after[id], normalizeErrorClass(raw), `${id}: SQL lệch normalizeErrorClass()`);
  asVersion1();
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
  assert.equal(db.prepare('SELECT error_class FROM nce_records WHERE nce_id=?').get(voided.data.nceId).error_class, 'RE');

  // 2. Hoàn dải nhà sản xuất không tạo hồ sơ NCE (D-12), nên không có dòng
  // nào mang nhãn "Hoàn dải QC" trong cột loại sai số.
  db.prepare("UPDATE test_levels SET applied='lab', mfg_mean=100, mfg_sd=2 WHERE test_id=? AND level=1").run(assay.id);
  const reverted = entry.revertManufacturerRange({ data: { testId: assay.id, level: 1, reason: 'Hoàn dải theo SOP để đối chiếu' } }, actor);
  assert.equal(reverted.ok, true, JSON.stringify(reverted));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM nce_records').get().n, 1, 'chỉ có hồ sơ của lần hủy điểm');

  // 3. Lập hồ sơ IQC: loại sai số do main đọc từ luật của lần chạy (2-2s → SE),
  // client gửi kèm nhãn dài hay mã khác cũng bị bỏ qua.
  ensureUser(db, actor);
  for (const day of ['2026-09-03', '2026-09-04']) {
    assert.equal(entry.addPoint({ data: { testId: assay.id, level: 1, date: day, runId: `${day}-1`, val: 105 } }, actor).ok, true);
  }
  const created = createIqcNce(nce, actor, assay.id, { date: '2026-09-04', runId: '2026-09-04-1' }, { errorType: 'RE — Sai số ngẫu nhiên' });
  assert.equal(created.record.error_class, 'SE');

  const stored = db.prepare('SELECT DISTINCT error_class FROM nce_records').all().map(r => r.error_class);
  assert.ok(stored.every(value => CODES.has(value)), `cột chỉ chứa mã: ${JSON.stringify(stored)}`);
});

test('các chỗ hiển thị đọc mã ra nhãn, không in giá trị thô', () => {
  const report = readFileSync(new URL('../renderer/pages/ReportPage.tsx', import.meta.url), 'utf8');
  const westgard = readFileSync(new URL('../main/ipc/westgard-handlers.ts', import.meta.url), 'utf8');
  assert.match(report, /ERROR_CLASS_LABEL\[r\.error_class\]/);
  // Bảng điểm Westgard: tín hiệu CUSUM phải cùng bộ từ vựng với luật thường,
  // không phải mã trần 'SE' bên cạnh "SE — Sai số hệ thống".
  assert.match(westgard, /cusumSignal \? ERROR_CLASS_LABEL\.SE : detail\.type/);
});
