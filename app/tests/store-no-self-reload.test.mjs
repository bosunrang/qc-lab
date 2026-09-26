// Kế hoạch kiến trúc D.1: store ghi xong KHÔNG tự nạp lại danh sách khi trang
// dùng nó đã nạp lại theo lời báo thay đổi của main (`useStoreInvalidation`)
// — tự nạp ở store làm danh sách nạp hai lần. Chỉ giữ tự nạp ở chỗ trang cần
// danh sách mới NGAY sau `await` (vd tạo phép so sánh rồi chọn luôn mục mới).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

/** Dựng store zustand từ mã nguồn với `window.qcApi` giả, ghi lại mọi lời gọi. */
function storeFrom(file, exportName, api) {
  const calls = [];
  const qcApi = new Proxy({}, {
    get: (_t, name) => async (...args) => {
      calls.push(String(name));
      return api[name] ? api[name](...args) : { ok: true, data: [] };
    },
  });
  let state;
  const create = (initialize) => { state = initialize((update) => { state = { ...state, ...(typeof update === 'function' ? update(state) : update) }; }, () => state); return { getState: () => state }; };
  const source = readFileSync(new URL(`../renderer/store/${file}`, import.meta.url), 'utf8');
  const stripped = stripTypeScriptTypes(source.replace(/^import [\s\S]*?;\r?\n/gm, '').replace(`export const ${exportName}`, `const ${exportName}`));
  const context = vm.createContext({ create, window: { qcApi }, output: null });
  vm.runInContext(`${stripped}\noutput = ${exportName};`, context);
  return { store: context.output.getState(), calls };
}

const ok = (data = null) => ({ ok: true, data });

test('Người dùng: tạo, sửa, xoá không tự nạp lại danh sách', async () => {
  const { store, calls } = storeFrom('users-store.ts', 'useUsersStore', {});
  await store.create({ username: 'a' });
  await store.update('u1', { name: 'A' });
  await store.remove('u1');
  assert.deepEqual(calls, ['createUser', 'updateUser', 'deleteUser']);
});

test('NCE: mọi thao tác ghi không tự nạp lại danh sách', async () => {
  const { store, calls } = storeFrom('nce-store.ts', 'useNceStore', {});
  await store.create({});
  await store.saveProtocol('n1', '', {});
  await store.approve('n1');
  await store.returnForRevision('n1', 'x');
  await store.cancel('n1', 'x');
  await store.setCompletedDate('n1', '2026-09-01');
  await store.markEffectiveness('n1', 'effective', '', '');
  await store.setReleaseDecision('n1', 'held', 'x');
  await store.setRerunEvidence('n1', 'p1', '');
  await store.reopen('n1', '');
  assert.equal(calls.filter((name) => name === 'listNceRecords').length, 0, calls.join(', '));
});

test('Khoá kỳ báo cáo không tự nạp lại danh sách kỳ khoá', async () => {
  const { store, calls } = storeFrom('report-store.ts', 'useReportStore', {});
  await store.lock('2026-09', '');
  await store.unlock('2026-09', 'lý do');
  assert.deepEqual(calls, ['lockPeriod', 'unlockPeriod']);
});

test('So sánh hoá chất: sửa, lưu dòng, xoá không tự nạp; tạo mới VẪN nạp để chọn ngay mục mới', async () => {
  const { store, calls } = storeFrom('reagent-store.ts', 'useReagentStore', { createReagentComparison: () => ok({ id: 'r1' }) });
  await store.saveMetadata('r1', {});
  await store.saveRows('r1', []);
  await store.remove('r1');
  assert.equal(calls.filter((name) => name === 'listReagentComparisons').length, 0, calls.join(', '));
  await store.create('Glucose', 'mmol/L');
  assert.deepEqual(calls.slice(-2), ['createReagentComparison', 'listReagentComparisons']);
});
