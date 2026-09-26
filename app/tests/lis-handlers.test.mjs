// Kiểm chứng END-TO-END lis-handlers.ts — mock `fetch` toàn cục (không cần
// chạy gateway thật). Trọng tâm: thứ tự "ghi trước, báo sau" —
// TUYỆT ĐỐI không gọi gateway nếu ghi điểm QC cục bộ thất bại.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { makeOperationalQc } from './helpers/operational-fixture.mjs';
const require = createRequire(import.meta.url);

const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createReportHandlers } = require('../../app-dist/main/ipc/report-handlers.js');
const { createLisHandlers } = require('../../app-dist/main/ipc/lis-handlers.js');

const db = openDatabase(':memory:');
const config = createConfigHandlers(db);
const report = createReportHandlers(db);
const lis = createLisHandlers(db);
const actor = { userId: 'u1', username: 'admin', name: 'Quan tri vien', role: 'admin', clientId: 'test-client' };
const viewer = { ...actor, role: 'viewer' };

const instrument = config.saveInstrument({ data: { name: 'May LIS' } }, actor).data;
const test = config.saveTest({ data: { name: 'Glucose LIS', instrumentId: instrument.id } }, actor).data;
makeOperationalQc(db, { testId: test.id, instrumentId: instrument.id, assignments: [{ level: 1 }] });

function fakeRecord(messageId, dateIso) {
  return {
    id: 'qcr_' + messageId, receivedAt: '2026-08-01T00:00:00.000Z', status: 'pending',
    message: { messageId, analyzerId: 'AU480', testCode: 'GLU', qcLevel: '1', value: 101, measuredAt: dateIso, runId: 'r1', operator: 'ktv1' },
    resolved: { ok: true, code: 'RESOLVED', qclabTestId: test.id, level: 1, lot: '', displayName: 'Glucose' },
  };
}

const defaults = lis.getSettings(actor);
assert.equal(defaults.enabled, false);
assert.equal(defaults.url, 'http://127.0.0.1:8787');

const forbiddenSave = lis.saveSettings({ data: { enabled: true, url: 'http://127.0.0.1:8787', token: 'tok1' } }, viewer);
assert.equal(forbiddenSave.ok, false);
assert.equal(forbiddenSave.error.code, 'forbidden');

const badUrl = lis.saveSettings({ data: { enabled: true, url: 'https://evil.example.com', token: 'tok1' } }, actor);
assert.equal(badUrl.ok, false);
assert.equal(badUrl.error.code, 'invalid-url');

const saved = lis.saveSettings({ data: { enabled: true, url: 'http://127.0.0.1:8787', token: 'tok1' } }, actor);
assert.equal(saved.ok, true);
assert.deepEqual(lis.getSettings(actor), { enabled: true, url: 'http://127.0.0.1:8787', token: 'tok1' });
assert.equal(lis.getSettings(viewer).token, '', 'token Gateway chỉ trả cho quản trị viên');
assert.equal(lis.getSettings(viewer).url, 'http://127.0.0.1:8787', 'các trường còn lại vẫn đọc được');

const fetchCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  fetchCalls.push({ url: String(url), opts });
  if (String(url).endsWith('/health')) return { ok: true, status: 200, json: async () => ({ ok: true }) };
  if (String(url).includes('/api/v1/qc-results?')) {
    return {
      ok: true, status: 200, json: async () => ({
        items: [fakeRecord('m1', '2026-08-05T10:00:00Z'), { id: 'qcr_m2', message: { messageId: 'm2' }, resolved: { ok: false, code: 'UNMAPPED_TEST', reason: 'chua mapping' } }],
      }),
    };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

const pulled = await lis.pullQueue();
assert.equal(pulled.ok, true, JSON.stringify(pulled));
assert.equal(pulled.data.pending.length, 1);
assert.equal(pulled.data.unresolved.length, 1);
assert.equal(pulled.data.pending[0].message.messageId, 'm1');
const healthCall = fetchCalls.find(c => c.url.endsWith('/health'));
assert.equal(healthCall.opts.headers.authorization, 'Bearer tok1', 'phai gui dung Bearer token');

fetchCalls.length = 0;
globalThis.fetch = async (url, opts) => {
  fetchCalls.push({ url: String(url), opts });
  return { ok: true, status: 200, json: async () => ({ record: {} }) };
};
const imported = await lis.importResult({ data: { record: fakeRecord('m3', '2026-08-06T02:00:00Z') } }, actor);
assert.equal(imported.ok, true, JSON.stringify(imported));
assert.ok(imported.data.pointId);
const point = db.prepare('SELECT * FROM qc_points WHERE id=?').get(imported.data.pointId);
assert.equal(point.val, 101);
assert.equal(point.test_id, test.id);
const decideCall = fetchCalls.find(c => c.url.includes('/decide'));
assert.ok(decideCall, 'phai co goi decide sau khi ghi thanh cong');
const decideBody = JSON.parse(decideCall.opts.body);
assert.equal(decideBody.messageId, 'm3');
assert.equal(decideBody.status, 'imported');

report.lockPeriod({ data: { ym: '2026-09', note: 'Chot ky' } }, actor);
fetchCalls.length = 0;
const blockedImport = await lis.importResult({ data: { record: fakeRecord('m4', '2026-09-10T02:00:00Z') } }, actor);
assert.equal(blockedImport.ok, false);
assert.equal(blockedImport.error.code, 'period-locked');
assert.equal(fetchCalls.length, 0, 'ghi that bai thi TUYET DOI khong duoc goi gateway - ban ghi phai con nguyen pending');

fetchCalls.length = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes('/decide')) throw new Error('ECONNREFUSED gia lap');
  return { ok: true, status: 200, json: async () => ({}) };
};
const importedButDecideFailed = await lis.importResult({ data: { record: fakeRecord('m5', '2026-08-07T02:00:00Z') } }, actor);
assert.equal(importedButDecideFailed.ok, true, 'diem da ghi thi KHONG duoc bao that bai toan bo');
assert.ok(importedButDecideFailed.data.pointId);
assert.ok(/chưa báo được về Gateway/.test(importedButDecideFailed.data.gatewayWarning));
const point5 = db.prepare('SELECT * FROM qc_points WHERE id=?').get(importedButDecideFailed.data.pointId);
assert.ok(point5, 'diem QC van duoc ghi that, khong bi xoa/rollback');

const unresolvedRecord = { id: 'qcr_m6', message: { messageId: 'm6', measuredAt: '2026-08-08T00:00:00Z' }, resolved: { ok: false, code: 'UNMAPPED_TEST', reason: 'x' } };
const rejectedInvalid = await lis.importResult({ data: { record: unresolvedRecord } }, actor);
assert.equal(rejectedInvalid.ok, false);
assert.equal(rejectedInvalid.error.code, 'invalid-record');

fetchCalls.length = 0;
globalThis.fetch = async (url, opts) => { fetchCalls.push({ url: String(url), opts }); return { ok: true, status: 200, json: async () => ({}) }; };
const rejected = await lis.rejectResult({ data: { messageId: 'm2', note: 'Sai don vi' } }, actor);
assert.equal(rejected.ok, true, JSON.stringify(rejected));
const rejectDecide = fetchCalls.find(c => c.url.includes('/decide'));
assert.equal(JSON.parse(rejectDecide.opts.body).status, 'rejected');
const activityRows = db.prepare("SELECT * FROM activity WHERE type=?").all('Bỏ kết quả QC từ LIS');
assert.equal(activityRows.length, 1);

globalThis.fetch = originalFetch;
console.log('app lis-handlers end-to-end tests passed');


