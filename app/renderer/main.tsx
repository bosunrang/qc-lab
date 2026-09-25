import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';
import { installBrowserMockIfNeeded } from './browser-mock/install';
import { createLanHttpApi } from './lan/http-api';
import { PageErrorBoundary } from './components/ErrorBoundary';
import { installUnhandledErrorReporting } from './lib/unhandled-errors';

// Chỉ cài khi không chạy trong Electron thật, ví dụ `vite dev` mở qua
// localhost. Ở Electron, hàm này trả `false` ngay lập tức (không nạp WASM,
// không tốn gì).
//
// PHẢI `await`: bản xem trước mở SQLite thật bằng sql.js/WASM nên việc dựng
// `window.qcApi` là bất đồng bộ. Render trước khi nó xong thì mọi trang thấy
const rootEl = document.getElementById('root');

async function start(): Promise<void> {
  const lan = location.port === '3200' && typeof window.qcApi === 'undefined';
  if (lan) window.qcApi = createLanHttpApi();
  const installed = lan ? false : await installBrowserMockIfNeeded();
  if (!rootEl) return;
  if (installed) rootEl.textContent = '';
  installUnhandledErrorReporting();
  // Lớp chặn ngoài cùng cho lỗi ở màn hình đăng nhập hoặc khung app; lỗi của
  // từng trang đã có lớp riêng trong `AppShell`.
  createRoot(rootEl).render(<PageErrorBoundary><AppRouter /></PageErrorBoundary>);
}

// Chỉ hiện khi thật sự phải chờ nạp WASM (chế độ xem trước); trong Electron
// `start()` đi qua nhánh `false` gần như tức thời nên không ai thấy dòng này.
if (rootEl && typeof window.qcApi === 'undefined') {
  rootEl.textContent = 'Đang khởi tạo bản xem trước…';
}

void start();
