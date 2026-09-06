import { createRoot } from 'react-dom/client';
import { AppRouter } from './router';
import { installBrowserMockIfNeeded } from './browser-mock/install';

// Chỉ cài mock khi KHÔNG chạy trong Electron thật (vd `vite dev` mở qua
// localhost) — xem docs/APP-V2-PLAN.md mục "Xem qua localhost".
installBrowserMockIfNeeded();

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(
    <AppRouter />,
  );
}
