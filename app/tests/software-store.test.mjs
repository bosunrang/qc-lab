import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { create } from 'zustand';

// Chạy store thật với transport giả để kiểm tra mất mạng và phản hồi lệch thứ tự.
function loadStore(api) {
  const source = readFileSync(new URL('../renderer/store/software-store.ts', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export const useSoftwareStore', 'const useSoftwareStore');
  const context = vm.createContext({ create, window: { qcApi: api }, output: null });
  vm.runInContext(`${stripTypeScriptTypes(source)}\noutput = useSoftwareStore;`, context);
  return context.output;
}

test('giấy phép: lỗi lần đầu vẫn chặn, mất mạng sau kích hoạt giữ trang nhập, hết hạn thật cập nhật ngay', async () => {
  let result = null;
  const store = loadStore({ getLicenseStatus: async () => { if (!result) throw new Error('Mất kết nối'); return result; } });
  await store.getState().loadLicense();
  assert.equal(store.getState().license, null);
  assert.ok(store.getState().licenseError);
  result = { state: 'active', runtime: 'lan', licensed_to: 'Đơn vị A' };
  await store.getState().loadLicense();
  const active = store.getState().license;
  assert.equal(store.getState().licenseError, '');
  result = null;
  await store.getState().loadLicense();
  assert.equal(store.getState().license, active, 'không tháo trang đang nhập chỉ vì máy chủ tạm mất kết nối');
  result = { ...active, state: 'expired' };
  await store.getState().loadLicense();
  assert.equal(store.getState().license.state, 'expired');
});

test('giấy phép: phản hồi kích hoạt cũ không ghi đè kết quả hết hạn mới hơn', async () => {
  const pending = [];
  const store = loadStore({ getLicenseStatus: () => new Promise((resolve) => pending.push(resolve)) });
  const old = store.getState().loadLicense(), latest = store.getState().loadLicense();
  pending[1]({ state: 'expired' }); await latest;
  pending[0]({ state: 'active' }); await old;
  assert.equal(store.getState().license.state, 'expired');
});

test('cập nhật: lỗi đọc trạng thái không thay giấy phép và không che thao tác QC', async () => {
  const store = loadStore({ getLicenseStatus: async () => ({ state: 'active' }), getSoftwareUpdateStatus: async () => { throw new Error('Mạng lỗi'); } });
  await store.getState().loadLicense();
  await store.getState().loadUpdate();
  assert.equal(store.getState().license.state, 'active');
  assert.equal(store.getState().licenseError, '');
  assert.equal(store.getState().update, null);
});
