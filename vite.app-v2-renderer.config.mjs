import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Thay module chỉ-chạy-được-ở-Node bằng bản trình duyệt khi build renderer.
//
// Bản xem trước qua trình duyệt chạy CHÍNH các handler `main/ipc/*` thật (xem
// browser-mock/real-api.ts), nên vài module `main/domain/*` phụ thuộc
// `node:crypto` phải có bản song song cho trình duyệt. Cả hai cặp dưới đây
// đều là THUẬT TOÁN GIỐNG HỆT, không phải bản giả lập:
//   ./sha256        -> sha256-browser.ts        (SHA-256 JS thuần, đồng bộ)
//   ./password-hash -> password-hash-browser.ts (PBKDF2-HMAC-SHA256 JS thuần)
// Lý do không dùng WebCrypto: nó async, còn writeAudit()/login() đồng bộ và
// chạy trong transaction SQLite. Hai bản BẮT BUỘC cho ra cùng kết quả —
// tests/sha256-parity.test.mjs và tests/password-hash-parity.test.mjs chốt
// điều đó, lấy node:crypto làm oracle.
// Khớp theo TÊN MODULE (phần cuối đường dẫn), không phải cả chuỗi import:
// cùng một module được import bằng đường dẫn khác nhau tuỳ chỗ gọi —
// `audit-chain.ts` viết './sha256' còn `auth-handlers.ts` viết
// '../domain/password-hash'. Khớp cả chuỗi thì bỏ lọt, và bỏ lọt ở đây
// KHÔNG hiện ra lúc build, chỉ hiện khi mở tab ('node:crypto has been
// externalized').
const NODE_ONLY_BROWSER_SWAPS = {
  'sha256': './app-v2/main/domain/sha256-browser.ts',
  'password-hash': './app-v2/main/domain/password-hash-browser.ts',
  'db-file-size': './app-v2/main/ipc/db-file-size-browser.ts',
};

const swapNodeOnlyModulesForBrowser = {
  name: 'swap-node-only-modules-for-browser',
  // `pre` là BẮT BUỘC: không có nó, resolver nội bộ của Vite giải `./sha256`
  // thành bản `node:crypto` trước và plugin này không bao giờ được hỏi tới
  // (đã kiểm chứng: tab báo 'node:crypto has been externalized for browser
  // compatibility'). `app-v2:build` xanh KHÔNG chứng minh plugin chạy đúng —
  // phải mở thật trong tab.
  enforce: 'pre',
  resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return null;
    const moduleName = source.split('/').pop();
    const replacement = NODE_ONLY_BROWSER_SWAPS[moduleName];
    if (!replacement) return null;
    // Chỉ đổi khi importer thật sự nằm trong `app-v2/main/`, để một
    // `./sha256` ở nơi khác không bị thay ngầm.
    const importerPath = importer.split(String.fromCharCode(92)).join('/');
    if (!importerPath.includes('/app-v2/main/')) return null;
    return fileURLToPath(new URL(replacement, import.meta.url));
  },
};
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
  plugins: [swapNodeOnlyModulesForBrowser, relaxCspForDevServer],
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
