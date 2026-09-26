// Cấu hình ESLint cho QC Lab.
//
// typescript-eslint chưa hỗ trợ TypeScript 7, nên gói `typescript` trong
// package.json là bí danh của `@typescript/typescript6` (API TypeScript 6 cho
// công cụ), còn trình biên dịch `tsc` lấy từ `@typescript/native` (TS 7). Khi
// typescript-eslint hỗ trợ TS 7 thì bỏ bí danh này.
//
// Chỉ bật hai luật hooks kinh điển. Bộ "recommended" của eslint-plugin-react-hooks
// v7 còn kèm các luật dành cho React Compiler (purity, refs, set-state-in-effect…)
// mà app chưa dùng.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['app-dist/**', 'dist/**', 'node_modules/**', 'docs/**'] },
  {
    files: ['app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['app/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Gọi hook trong điều kiện/vòng lặp làm React trộn state giữa các lần render.
      'react-hooks/rules-of-hooks': 'error',
      // Effect/memo thiếu phụ thuộc thì trang giữ dữ liệu cũ. Để mức cảnh báo:
      // không phải chỗ nào thiếu cũng là lỗi, cần đọc từng chỗ.
      'react-hooks/exhaustive-deps': 'warn',
      // Đọc cả store (`useXStore()` không selector) làm component vẽ lại khi
      // BẤT KỲ trường nào của store đổi (kế hoạch kiến trúc D.2). Chọn đúng
      // trường cần dùng: `useXStore((s) => s.x)` hoặc `useShallow(...)`.
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.name=/^use[A-Z]\\w*Store$/][arguments.length=0]',
        message: 'Không đọc cả store; truyền selector hoặc useShallow((s) => ({ ... })).',
      }],
    },
  },
  // Ranh giới renderer ↔ main (kế hoạch kiến trúc D.12). Renderer chỉ được
  // dùng hàm thuần của `main/domain`, không import handler, CSDL, Electron hay
  // builtin của Node. Riêng bản xem trước (`browser-mock/`) cố ý chạy handler
  // thật trên sql.js nên được miễn.
  {
    files: ['app/renderer/**/*.{ts,tsx}'],
    ignores: ['app/renderer/browser-mock/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'electron', message: 'Renderer không dùng Electron trực tiếp; gọi qua window.qcApi.' }],
        patterns: [
          { group: ['**/main/ipc/**', '**/main/db/**', '**/main/lan/**', '**/main/logging/**', '**/main/index', '**/main/preload'], message: 'Renderer chỉ được import hàm thuần của main/domain; dữ liệu đi qua window.qcApi.' },
          { group: ['node:*'], message: 'Renderer chạy trong trình duyệt/sandbox, không có builtin của Node.' },
        ],
      }],
    },
  },
  // `main/domain` là hàm thuần dùng chung với renderer và bản xem trước:
  // không phụ thuộc handler, CSDL, Electron hay I/O. `node:crypto`/`node:util`
  // được phép vì đã có bản thay thế cho trình duyệt (`*-browser.ts`, alias ở
  // vite.app-renderer.config.mjs).
  {
    files: ['app/main/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'electron', message: 'main/domain phải là hàm thuần, không dùng Electron.' }],
        patterns: [
          { group: ['../ipc/**', '../db/**', '../lan/**', '../logging/**', '../index', '../preload'], message: 'main/domain không được phụ thuộc handler, CSDL hay tầng vận hành.' },
          { group: ['node:*', '!node:crypto', '!node:util'], message: 'main/domain không làm I/O; chỉ node:crypto/node:util có bản thay thế cho trình duyệt.' },
        ],
      }],
    },
  },
  // Handler ghi dữ liệu đi qua `writeCommand()` (`app/main/ipc/write-command.ts`):
  // quyền → kiểm dữ liệu → transaction → nhật ký → báo thay đổi được ép bằng
  // mã, không còn là quy ước. Gọi thẳng các bước đó trong handler là bỏ qua
  // cổng. Ngoại lệ duy nhất là thao tác TRƯỚC khi đăng nhập (khởi tạo quản trị,
  // đăng nhập) — chưa có actor để qua cổng; chỗ đó ghi `eslint-disable` kèm lý do.
  {
    files: ['app/main/ipc/*-handlers.ts'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.name=/^(writeAudit|notifyChanged|withTransaction)$/]',
        message: 'Thao tác ghi đi qua writeCommand(): dùng w.commit(tx => …), tx.audit() và tx.changed().',
      }],
    },
  },
];
