// Đo kích thước file SQLite trên đĩa — bản MAIN PROCESS.
//
// Tách khỏi `settings-handlers.ts` (2026-09-09) vì đó là dòng `node:fs` DUY
// NHẤT trong 10 nhóm handler mà bản xem trước qua trình duyệt chạy lại được
// (xem browser-mock/real-api.ts). Vite biến mọi builtin của Node thành proxy
// ném lỗi NGAY KHI MODULE LOAD, nên chỉ cần một `import { statSync } from
// 'node:fs'` ở đầu file là cả handler không nạp được trong tab.
//
// Bản trình duyệt: `db-file-size-browser.ts`, thay vào bởi plugin
// `swap-node-only-modules-for-browser` trong vite.app-v2-renderer.config.mjs.
import { statSync } from 'node:fs';

export function dbFileBytes(dbPath: string): number {
  if (dbPath === ':memory:') return 0;
  try {
    return statSync(dbPath).size;
  } catch {
    return 0;
  }
}
