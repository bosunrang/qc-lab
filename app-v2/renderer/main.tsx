import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';
import { installBrowserMockIfNeeded } from './browser-mock/install';

// Chỉ cài khi KHÔNG chạy trong Electron thật (vd `vite dev` mở qua
// localhost) — xem docs/APP-V2-PLAN.md mục "Xem qua localhost". Trong
// Electron, hàm này trả `false` ngay lập tức (không nạp WASM, không tốn gì).
//
// PHẢI `await`: bản xem trước mở SQLite thật bằng sql.js/WASM nên việc dựng
// `window.qcApi` là bất đồng bộ. Render trước khi nó xong thì mọi trang thấy
// `window.qcApi === undefined`.
const rootEl = document.getElementById('root');

async function start(): Promise<void> {
  const installed = await installBrowserMockIfNeeded();
  if (!rootEl) return;
  if (installed) rootEl.textContent = '';
  createRoot(rootEl).render(<AppRouter />);
}

// Chỉ hiện khi thật sự phải chờ nạp WASM (chế độ xem trước); trong Electron
// `start()` đi qua nhánh `false` gần như tức thời nên không ai thấy dòng này.
if (rootEl && typeof window.qcApi === 'undefined') {
  rootEl.textContent = 'Đang khởi tạo bản xem trước…';
}

void start();
