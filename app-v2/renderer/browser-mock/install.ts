// Cài `window.qcApi` giả lập khi chạy `vite dev` (không có Electron/preload
// thật — `window.qcApi` chỉ tồn tại khi `preload.ts`'s
// `contextBridge.exposeInMainWorld('qcApi', ...)` đã chạy, tức là đang chạy
// trong Electron thật). Gọi hàm này TRƯỚC khi render — xem main.tsx.
import { createBrowserMockApi } from './api';
import { withPermissionPolicy } from './permission-policy';

export function installBrowserMockIfNeeded(): boolean {
  if (typeof window.qcApi !== 'undefined') return false;
  // Bọc bằng CÙNG chính sách quyền của main process — xem permission-policy.ts.
  (window as unknown as { qcApi: unknown }).qcApi = withPermissionPolicy(createBrowserMockApi());
  return true;
}
