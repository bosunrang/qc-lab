// Lỗi hiển thị và lỗi không được bắt ở renderer (kế hoạch D.4, D.5):
// - một trang lỗi khi render chỉ thay vùng nội dung của trang đó, không làm
//   trắng cả app; đổi trang thì tự bỏ trạng thái lỗi;
// - promise bị từ chối / lỗi trong trình xử lý sự kiện được báo cho người
//   dùng, nhưng không mở đè hộp thoại đang chờ;
// - Tổng quan không treo ở trạng thái tải khi một lệnh IPC lỗi.
//
// Nạp module renderer thật bằng `ssrLoadModule` của Vite (xử lý TSX và import
// không đuôi), không chép lại mã vào test.
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const RENDERER = fileURLToPath(new URL('../renderer', import.meta.url));
let server;
before(async () => {
  server = await createServer({
    configFile: false, root: RENDERER, logLevel: 'error', appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
  });
});
after(async () => { await server?.close(); });
const load = (path) => server.ssrLoadModule(path);

test('PageErrorBoundary: bắt lỗi thành trạng thái, hiện thông báo kèm nội dung lỗi', async () => {
  const { PageErrorBoundary } = await load('/components/ErrorBoundary.tsx');
  assert.equal(PageErrorBoundary.getDerivedStateFromError(new Error('thiếu trường level')).error.message, 'thiếu trường level');
  assert.equal(PageErrorBoundary.getDerivedStateFromError('chuỗi lỗi').error.message, 'chuỗi lỗi', 'lỗi không phải Error vẫn thành Error');

  const boundary = new PageErrorBoundary({ children: createElement('p', null, 'nội dung trang') });
  assert.equal(renderToStaticMarkup(boundary.render()), '<p>nội dung trang</p>', 'không lỗi thì hiện trang bình thường');
  boundary.state = { error: new Error('thiếu trường level') };
  const html = renderToStaticMarkup(boundary.render());
  assert.match(html, /role="alert"/);
  assert.match(html, /Trang này gặp lỗi khi hiển thị/);
  assert.match(html, /Dữ liệu đã lưu không bị ảnh hưởng/);
  assert.match(html, /thiếu trường level/);
  assert.match(html, />Thử lại</);
  assert.match(html, />Tải lại ứng dụng</);
});

test('PageErrorBoundary: đổi trang thì bỏ trạng thái lỗi, ở lại trang cũ thì giữ', async () => {
  const { PageErrorBoundary } = await load('/components/ErrorBoundary.tsx');
  const boundary = new PageErrorBoundary({ resetKey: '/sigma', children: null });
  const updates = [];
  boundary.setState = (next) => updates.push(next);
  boundary.state = { error: new Error('x') };
  boundary.componentDidUpdate({ resetKey: '/sigma', children: null });
  assert.deepEqual(updates, [], 'cùng trang: giữ thông báo lỗi');
  boundary.props = { resetKey: '/entry', children: null };
  boundary.componentDidUpdate({ resetKey: '/sigma', children: null });
  assert.deepEqual(updates, [{ error: null }]);
});

// Bọc từng trang trong `AppShell` và báo lỗi không được bắt được kiểm trên app
// thật ở `e2e/window-shell.e2e.mjs`. Lớp ngoài cùng chỉ bắt lỗi của chính
// khung app, không dựng được lỗi đó từ ngoài nên vẫn kiểm theo mã.
test('lớp ngoài cùng bọc cả app', () => {
  const entry = readFileSync(new URL('../renderer/main.tsx', import.meta.url), 'utf8');
  assert.match(entry, /render\(<PageErrorBoundary><AppRouter \/><\/PageErrorBoundary>\)/);
});

test('lỗi không được bắt: báo người dùng, không mở đè hộp thoại đang chờ, bỏ qua lỗi vô hại', async () => {
  const { reportUnhandled, unhandledMessage } = await load('/lib/unhandled-errors.ts');
  const shown = [];
  let dialogOpen = false;
  const deps = { dialogOpen: () => dialogOpen, show: (message) => shown.push(message), log: () => {} };

  reportUnhandled(new Error('SQLITE_BUSY'), deps);
  assert.equal(shown.length, 1);
  assert.match(shown[0], /SQLITE_BUSY/);
  assert.match(shown[0], /Dữ liệu đã lưu không bị ảnh hưởng/);

  dialogOpen = true;
  reportUnhandled(new Error('lỗi thứ hai'), deps);
  assert.equal(shown.length, 1, 'đang có hộp thoại (vd xác nhận huỷ điểm) thì không mở đè');

  dialogOpen = false;
  reportUnhandled(new Error('ResizeObserver loop completed with undelivered notifications.'), deps);
  assert.equal(shown.length, 1, 'lỗi ResizeObserver của trình duyệt không phải lỗi thao tác');

  const reported = [];
  reportUnhandled(new Error('lỗi cần ghi log'), { ...deps, report: (reason) => reported.push(reason.message) });
  reportUnhandled(new Error('ResizeObserver loop limit exceeded'), { ...deps, report: (reason) => reported.push(reason.message) });
  assert.deepEqual(reported, ['lỗi cần ghi log'], 'lỗi thật được gửi về tệp log của máy chính, lỗi vô hại thì không');

  assert.equal(unhandledMessage('chuỗi'), 'chuỗi');
  assert.equal(unhandledMessage({ code: 1 }), 'không có mô tả');
});

test('Tổng quan không treo ở trạng thái tải khi IPC lỗi, và nạp lại được', async () => {
  let fail = true;
  globalThis.window = { qcApi: {
    listTestSummaries: async () => { if (fail) throw new Error('IPC hỏng'); return []; },
    listNceRecords: async () => [], listTests: async () => [], listPanels: async () => [], listLots: async () => [],
  } };
  try {
    const { useDashboardStore } = await load('/store/dashboard-store.ts');
    assert.equal(useDashboardStore.getState().loading, true);
    await useDashboardStore.getState().load();
    assert.equal(useDashboardStore.getState().loading, false, 'hạ cờ tải khi lỗi');
    assert.equal(useDashboardStore.getState().error, 'IPC hỏng');
    fail = false;
    await useDashboardStore.getState().load();
    assert.equal(useDashboardStore.getState().error, null, 'Thử lại thành công thì bỏ lỗi');
  } finally {
    delete globalThis.window;
  }
});
