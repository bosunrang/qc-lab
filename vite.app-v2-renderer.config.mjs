import { defineConfig } from 'vite';

// Renderer của app-v2 — Vite build thật (ES module, không IIFE thủ công như
// bản cũ) vì đây là app Electron-only, không cần né minify để giữ diffable
// theo quy ước app cũ (đó là ràng buộc riêng của việc gộp bundle với bundle
// classic, không áp dụng ở đây).

// CSP thật (index.html) rất chặt (script-src 'self', không unsafe-eval) —
// đúng cho bản Electron đóng gói, nhưng chặn WebSocket HMR + eval của
// `vite dev`. Chỉ nới lỏng khi `ctx.server` tồn tại (đang chạy dev server
// qua `npm run app-v2:dev`, KHÔNG áp dụng khi build cho Electron thật qua
// `npm run app-v2:build`) — xem docs/APP-V2-PLAN.md mục "Xem qua localhost".
const relaxCspForDevServer = {
  name: 'relax-csp-for-dev-server',
  transformIndexHtml(html, ctx) {
    if (!ctx.server) return html;
    return html.replace(
      /<meta http-equiv="Content-Security-Policy"[^>]*>/,
      '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; font-src \'self\'; img-src \'self\' data: blob:; connect-src \'self\' ws://localhost:* http://localhost:*">',
    );
  },
};

export default defineConfig({
  root: 'app-v2/renderer',
  base: './',
  plugins: [relaxCspForDevServer],
  // Cổng không cố định — Claude Code's preview harness gán cổng qua biến môi
  // trường PORT (autoPort trong .claude/launch.json); mặc định 5174 khi chạy
  // ngoài harness (vd `npm run app-v2:dev` tay).
  server: {
    // `host: true` = lắng nghe CẢ IPv4 lẫn IPv6. Mặc định Vite chỉ bind
    // `[::1]`, nên trình duyệt nào phân giải `localhost` thành `127.0.0.1`
    // sẽ báo không kết nối được (đo được 2026-09-03: `curl localhost:5174`
    // trả 200 nhưng `curl 127.0.0.1:5174` trả lỗi kết nối). Đây là server
    // xem trước chỉ chạy khi gọi tay `npm run app-v2:dev`, dữ liệu là bản
    // giả lập trong localStorage — không phải server sản phẩm.
    host: true,
    port: Number(process.env.PORT) || 5174,
    strictPort: false,
  },
  build: {
    outDir: '../../app-v2-dist/renderer',
    emptyOutDir: true,
  },
});
