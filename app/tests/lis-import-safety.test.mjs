import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';

const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createLisHandlers } = require('../../app-dist/main/ipc/lis-handlers.js');
const { createEntryHandlers } = require('../../app-dist/main/ipc/entry-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { applySchema, SCHEMA_VERSION } = require('../../app-dist/main/db/schema.js');
const { dumpAllTables, restoreAllTables, recordsLostByRestore } = require('../../app-dist/main/db/table-io.js');

function must(result) { assert.equal(result.ok, true, JSON.stringify(result)); return result.data; }
function fixture(t, file = ':memory:') {
  const db = openDatabase(file), config = createConfigHandlers(db), lis = createLisHandlers(db);
  const actor = { userId: 'lis-admin', username: 'admin', name: 'Người nhận LIS', role: 'admin', clientId: 'test' };
  const instrument = must(config.saveInstrument({ data: { name: 'Máy LIS' } }, actor));
  const assay = must(config.saveTest({ data: { name: 'Glucose LIS', instrumentId: instrument.id, unit: 'mmol/L' } }, actor));
  const operational = makeOperationalQc(db, { testId: assay.id, instrumentId: instrument.id, assignments: [{ level: 1, lotNo: 'CURRENT' }] });
  must(config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 100, sd: 2, qcLotId: operational.lotIds[0] } }, actor));
  must(lis.saveSettings({ data: { enabled: true, url: 'http://127.0.0.1:8787', token: 'test-only' } }, actor));
  const state = { queue: [], ackFails: false, readFails: false, loseResponse: false, calls: [] };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (state.readFails) throw new Error('Mất kết nối');
    if (String(url).includes('qc-results?')) return { ok: true, json: async () => ({ items: structuredClone(state.queue) }) };
    if (String(url).endsWith('/decide')) {
      const body = JSON.parse(options.body); state.calls.push(body);
      if (state.ackFails) throw new Error('Mất xác nhận');
      state.queue = state.queue.filter((item) => item.message.messageId !== body.messageId);
      if (state.loseResponse) throw new Error('Đã xử lý nhưng mất phản hồi');
    }
    return { ok: true, json: async () => ({ ok: true }) };
  };
  t.after(() => { globalThis.fetch = originalFetch; try { db.close(); } catch { /* Có ca đóng rồi mở lại CSDL. */ } });
  const record = (id = 'message-1', value = 100) => ({ id, status: 'pending', receivedAt: '2026-08-05T07:00:00+07:00',
    message: { messageId: id, analyzerId: 'LIS-01', testCode: 'GLU', qcLevel: 'L1', qcLotCode: 'CURRENT', unit: 'mmol/L',
      value, measuredAt: '2026-08-05T07:00:00+07:00', runId: id },
    resolved: { ok: true, code: 'RESOLVED', qclabTestId: assay.id, level: 1, lot: 'CURRENT', displayName: 'Glucose' } });
  return { db, config, lis, actor, assay, operational, state, record,
    receive: (item) => { state.queue = [item]; return lis.importResult({ data: { record: item } }, actor); },
    count: (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n };
}

test('LIS: nhận đúng lô, giá trị và đơn vị; ghi dấu vết nguồn cùng điểm QC', async (t) => {
  const f = fixture(t);
  const saved = must(await f.receive(f.record()));
  const point = f.db.prepare('SELECT lot,val FROM qc_points WHERE id=?').get(saved.pointId);
  assert.equal(point.lot, 'CURRENT'); assert.equal(point.val, 100);
  const receipt = f.db.prepare('SELECT * FROM lis_imports').get();
  assert.equal(receipt.point_id, saved.pointId);
  assert.ok(receipt.acknowledged_at);
  assert.equal(JSON.parse(receipt.record_json).message.unit, 'mmol/L');
});

test('LIS: không ép giá trị thiếu, trống, boolean hoặc sai định dạng thành 0', async (t) => {
  const f = fixture(t);
  for (const [index, value] of [null, undefined, '', '  ', false, true, [], {}, NaN, Infinity, '12,5', '12abc'].entries()) {
    const record = f.record(`invalid-${index}`); record.message.value = value;
    const result = await f.receive(record);
    assert.equal(result.ok, false, `Không được nhận ${String(value)}`);
  }
  assert.equal(f.count('qc_points'), 0); assert.equal(f.count('lis_imports'), 0); assert.equal(f.state.calls.length, 0);
});

test('LIS: số 0 thật và chuỗi số hợp lệ vẫn được nhận', async (t) => {
  const f = fixture(t);
  for (const [id, value, expected] of [['zero', 0, 0], ['numeric', '1e2', 100]]) {
    const saved = must(await f.receive(f.record(id, value)));
    assert.equal(f.db.prepare('SELECT val FROM qc_points WHERE id=?').get(saved.pointId).val, expected);
  }
});

test('LIS: thiếu lô hoặc lô khác không được rơi về lô đang dùng', async (t) => {
  const f = fixture(t);
  for (const lot of ['', 'OTHER', '  ']) {
    const record = f.record(`lot-${lot || 'empty'}`); record.resolved.lot = lot;
    assert.equal((await f.receive(record)).ok, false);
  }
  assert.equal(f.count('qc_points'), 0); assert.equal(f.state.calls.length, 0);
});

test('LIS: đơn vị khác hoặc chưa khai bị chặn, không tự quy đổi', async (t) => {
  const f = fixture(t);
  for (const unit of ['', 'mg/dL', 'MMOL/L']) {
    const record = f.record(`unit-${unit || 'empty'}`); record.message.unit = unit;
    assert.equal((await f.receive(record)).ok, false);
  }
  f.db.prepare("UPDATE tests SET unit='' WHERE id=?").run(f.assay.id);
  assert.equal((await f.receive(f.record('missing-unit'))).error.code, 'lis-unit-mismatch');
  assert.equal(f.count('qc_points'), 0); assert.equal(f.state.calls.length, 0);
});

test('LIS: lô song song hợp lệ nhận đúng lô và Mean/SD ứng viên', async (t) => {
  const f = fixture(t);
  const lot = must(f.config.saveLot({ data: { lotNo: 'PARALLEL', level: 1 } }, f.actor));
  must(f.config.createLotTransition({ data: { panelId: f.operational.panelId, fromLotId: f.operational.lotIds[0], toLotId: lot.id,
    startDate: '2026-08-01', status: 'active', criteria: [{ testId: f.assay.id, level: 1, mean: 200, sd: 4 }] } }, f.actor));
  const record = f.record('parallel', 200); record.resolved.lot = 'PARALLEL';
  const saved = must(await f.receive(record));
  const point = f.db.prepare('SELECT lot,qc_mean,qc_sd FROM qc_points WHERE id=?').get(saved.pointId);
  assert.equal(point.lot, 'PARALLEL'); assert.equal(point.qc_mean, 200); assert.equal(point.qc_sd, 4);
  assert.equal(createEntryHandlers(f.db).queryPoints(f.assay.id, 1).length, 0);
});

test('LIS: kỳ khoá giữ nguyên hàng chờ, không tạo dấu vết nhận hoặc báo imported', async (t) => {
  const f = fixture(t);
  must(createReportHandlers(f.db).lockPeriod({ data: { ym: '2026-08', note: 'Kiểm tra LIS', acknowledge: true } }, f.actor));
  assert.equal((await f.receive(f.record())).error.code, 'period-locked');
  assert.equal(f.count('lis_imports'), 0); assert.equal(f.count('qc_points'), 0); assert.equal(f.state.calls.length, 0);
});

test('LIS: lỗi ghi dấu vết hoàn nguyên cả điểm QC và nhật ký, không gửi xác nhận', async (t) => {
  const f = fixture(t), audits = f.count('activity');
  f.db.exec("CREATE TRIGGER fail_lis_receipt BEFORE INSERT ON lis_imports BEGIN SELECT RAISE(ABORT, 'receipt-failed'); END");
  await assert.rejects(f.receive(f.record()), /receipt-failed/);
  assert.equal(f.count('qc_points'), 0); assert.equal(f.count('lis_imports'), 0);
  assert.equal(f.count('activity'), audits); assert.equal(f.state.calls.length, 0);
});

test('LIS: nhận lại sau mất xác nhận dùng đúng pointId, không thêm điểm hoặc lặp nhập', async (t) => {
  const f = fixture(t), record = f.record(); f.state.ackFails = true;
  const first = must(await f.receive(record)); assert.ok(first.gatewayWarning);
  const imports = f.db.prepare("SELECT COUNT(*) AS n FROM activity WHERE type='Nhận QC từ LIS'").get().n;
  f.state.ackFails = false;
  const retried = must(await f.lis.importResult({ data: { record } }, f.actor));
  assert.equal(retried.pointId, first.pointId); assert.equal(retried.gatewayWarning, undefined);
  assert.equal(f.state.queue.length, 0); assert.equal(f.count('qc_points'), 1); assert.equal(f.count('lis_imports'), 1);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM activity WHERE type='Nhận QC từ LIS'").get().n, imports);
  assert.equal(must(await f.lis.importResult({ data: { record } }, f.actor)).pointId, first.pointId);
});

test('LIS: Gateway đã xử lý nhưng mất phản hồi vẫn nhận lại an toàn', async (t) => {
  const f = fixture(t), record = f.record(); f.state.loseResponse = true;
  const first = must(await f.receive(record)); assert.ok(first.gatewayWarning); assert.equal(f.state.queue.length, 0);
  f.state.loseResponse = false;
  const retry = must(await f.lis.importResult({ data: { record } }, f.actor));
  assert.equal(retry.pointId, first.pointId); assert.equal(f.count('qc_points'), 1); assert.equal(retry.gatewayWarning, undefined);
});

test('LIS: làm mới hàng chờ tự gửi lại xác nhận, kể cả sau khi tạo lại handler', async (t) => {
  const f = fixture(t); f.state.ackFails = true;
  const first = must(await f.receive(f.record()));
  f.state.ackFails = false;
  const queue = must(await createLisHandlers(f.db).pullQueue(f.actor));
  assert.equal(queue.pending.length, 0); assert.equal(f.state.queue.length, 0);
  assert.equal(f.count('qc_points'), 1);
  assert.equal(f.db.prepare('SELECT point_id FROM lis_imports').get().point_id, first.pointId);
});

test('LIS: mở lại CSDL và đổi localhost vẫn giữ mã bản tin đã nhận', async (t) => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'qc-lis-')), 'qc.db');
  const f = fixture(t, file), record = f.record(); f.state.ackFails = true;
  const first = must(await f.receive(record)); f.db.close();
  const reopened = openDatabase(file); t.after(() => reopened.close());
  const lis = createLisHandlers(reopened); f.state.ackFails = false;
  must(lis.saveSettings({ data: { enabled: true, url: 'http://localhost:8787', token: 'changed-token' } }, f.actor));
  const retried = must(await lis.importResult({ data: { record } }, f.actor));
  assert.equal(retried.pointId, first.pointId);
  assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM qc_points').get().n, 1);
});

test('LIS: hai yêu cầu nhận đồng thời chỉ tạo một điểm và một dấu vết', async (t) => {
  const f = fixture(t), record = f.record(); f.state.queue = [record];
  const results = await Promise.all([f.lis.importResult({ data: { record } }, f.actor), f.lis.importResult({ data: { record } }, f.actor)]);
  assert.equal(must(results[0]).pointId, must(results[1]).pointId);
  assert.equal(f.count('qc_points'), 1); assert.equal(f.count('lis_imports'), 1);
});

test('LIS: retry không đổi lô sau khi cấu hình lô đã chuyển hoặc kỳ đã khoá', async (t) => {
  const f = fixture(t), record = f.record(); f.state.ackFails = true;
  const first = must(await f.receive(record));
  const lot = must(f.config.saveLot({ data: { lotNo: 'AFTER', level: 1 } }, f.actor));
  must(f.config.saveTestLevel({ testId: f.assay.id, data: { level: 1, mean: 200, sd: 3, qcLotId: lot.id } }, f.actor));
  must(createReportHandlers(f.db).lockPeriod({ data: { ym: '2026-08', acknowledge: true } }, f.actor));
  f.state.ackFails = false;
  assert.equal(must(await f.lis.importResult({ data: { record } }, f.actor)).pointId, first.pointId);
  assert.equal(f.db.prepare('SELECT lot FROM qc_points WHERE id=?').get(first.pointId).lot, 'CURRENT');
  assert.equal(f.count('qc_points'), 1);
});

test('LIS: cùng mã nhưng nguồn đổi giá trị không được xác nhận hoặc ghi đè', async (t) => {
  const f = fixture(t), record = f.record(); f.state.ackFails = true;
  must(await f.receive(record)); f.state.ackFails = false; f.state.calls = [];
  record.message.value = 999; f.state.queue = [record];
  const result = await f.lis.importResult({ data: { record } }, f.actor);
  assert.equal(result.error.code, 'lis-message-conflict'); assert.equal(f.state.calls.length, 0);
  const queue = must(await f.lis.pullQueue(f.actor));
  assert.equal(queue.pending.length, 0); assert.equal(queue.unresolved.length, 1);
  assert.equal(f.db.prepare('SELECT val FROM qc_points').get().val, 100);
});

test('LIS: không nhận nhầm điểm nhập tay là bản tin LIS và không bỏ bản tin đã lưu', async (t) => {
  const f = fixture(t), record = f.record();
  must(createEntryHandlers(f.db).addPoint({ data: { testId: f.assay.id, level: 1, date: '2026-08-05', runId: record.message.runId, val: 100 } }, f.actor));
  assert.equal((await f.receive(record)).error.code, 'duplicate-run');
  assert.equal(f.count('lis_imports'), 0); assert.equal(f.state.calls.length, 0);
  const second = f.record('with-receipt'); f.state.ackFails = true;
  must(await f.receive(second)); f.state.calls = [];
  assert.equal((await f.lis.rejectResult({ data: { messageId: second.message.messageId } }, f.actor)).error.code, 'already-imported');
  assert.equal(f.state.calls.length, 0);
});

test('LIS: chỉ-xem không được nhận mới, retry hoặc kích hoạt gửi xác nhận qua hàng chờ', async (t) => {
  const f = fixture(t), record = f.record(), viewer = { ...f.actor, role: 'viewer' };
  f.state.queue = [record];
  assert.equal((await f.lis.importResult({ data: { record } }, viewer)).error.code, 'forbidden');
  f.state.ackFails = true; must(await f.receive(record)); f.state.calls = [];
  assert.equal((await f.lis.importResult({ data: { record } }, viewer)).error.code, 'forbidden');
  assert.equal((await f.lis.pullQueue(viewer)).error.code, 'forbidden'); assert.equal(f.state.calls.length, 0);
});

test('LIS: migration và backup giữ được dấu vết, phục hồi không làm mất bảo vệ nhận trùng', async (t) => {
  const f = fixture(t); f.db.exec('DROP TABLE lis_imports');
  f.db.prepare("UPDATE app_meta SET value='12' WHERE key='schemaVersion'").run(); applySchema(f.db);
  assert.equal(f.db.prepare("SELECT value FROM app_meta WHERE key='schemaVersion'").get().value, String(SCHEMA_VERSION));
  f.state.ackFails = true; const first = must(await f.receive(f.record()));
  const snapshot = dumpAllTables(f.db);
  const restored = openDatabase(':memory:'); t.after(() => restored.close());
  restoreAllTables(restored, snapshot);
  assert.equal(restored.prepare('SELECT point_id FROM lis_imports').get().point_id, first.pointId);
  const withoutReceipts = { ...snapshot, lis_imports: [] };
  assert.ok(recordsLostByRestore(f.db, { kind: 'json', data: withoutReceipts }).some((loss) => loss.table === 'lis_imports'));
});

test('LIS: hàng chờ giữ nguyên lý do chưa ánh xạ và tách bản tin sai dữ liệu khỏi sẵn sàng nhận', async (t) => {
  const f = fixture(t), unmapped = f.record('unmapped'), badUnit = f.record('bad-unit'), badLot = f.record('bad-lot');
  unmapped.resolved = { ok: false, code: 'UNMAPPED_TEST', reason: 'Chưa ánh xạ mã GLU' };
  badUnit.message.unit = 'mg/dL'; badLot.resolved.lot = 'OTHER';
  f.state.queue = [unmapped, badUnit, badLot, f.record('valid')];
  const queue = must(await f.lis.pullQueue(f.actor));
  assert.equal(queue.pending.length, 1); assert.equal(queue.unresolved.length, 3);
  assert.equal(queue.unresolved[0].resolved.reason, 'Chưa ánh xạ mã GLU');
  assert.equal(f.count('qc_points'), 0); assert.equal(f.state.calls.length, 0);
});

test('LIS: bản tin đã nhận rồi huỷ điểm không tạo lại điểm khi gửi lại xác nhận', async (t) => {
  const f = fixture(t), record = f.record(); f.state.ackFails = true;
  const saved = must(await f.receive(record));
  must(createEntryHandlers(f.db).voidPoint({ data: { pointId: saved.pointId, kind: 'data-entry', reason: '' } }, f.actor));
  f.state.ackFails = false;
  assert.equal(must(await f.lis.importResult({ data: { record } }, f.actor)).pointId, saved.pointId);
  assert.equal(f.count('qc_points'), 1);
  assert.equal(f.db.prepare('SELECT voided FROM qc_points WHERE id=?').get(saved.pointId).voided, 1);
});
