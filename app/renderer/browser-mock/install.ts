// Cài `window.qcApi` cho bản xem trước khi KHÔNG chạy trong Electron thật
// (`window.qcApi` chỉ tồn tại sau khi `preload.ts`'s
// `contextBridge.exposeInMainWorld('qcApi', ...)` đã chạy).
//
// Từ 2026-09-09 đây KHÔNG còn là bản giả lập viết tay: nó chạy CHÍNH các
// handler `main/ipc/*` thật trên SQLite (sql.js/WASM) trong IndexedDB —
// xem `real-api.ts`. Vì nạp WASM là bất đồng bộ, hàm này trả Promise và
// `main.tsx` phải `await` trước khi render.
//
// Không còn `withPermissionPolicy()`: ranh giới quyền giờ là chính
// `requireWrite()`/`requireAdmin()` trong handler thật, không phải một bảng
// chính sách thứ hai phải giữ đồng bộ bằng tay.
export async function installBrowserMockIfNeeded(): Promise<boolean> {
  if (typeof window.qcApi !== 'undefined') return false;
  const { createRealBrowserApi } = await import('./real-api');
  (window as unknown as { qcApi: unknown }).qcApi = await createRealBrowserApi();
  return true;
}


