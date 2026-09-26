// Đo kích thước file SQLite trên đĩa — bản MAIN PROCESS.
//
// Tách khỏi `settings-handlers.ts` (2026-09-09) vì đó là dòng `node:fs` DUY
// NHẤT trong 10 nhóm handler mà bản xem trước qua trình duyệt chạy lại được
// (xem browser-mock/real-api.ts). Vite biến mọi builtin của Node thành proxy
// ném lỗi NGAY KHI MODULE LOAD, nên chỉ cần một `import { statSync } from
// 'node:fs'` ở đầu file là cả handler không nạp được trong tab.
//
// Bản trình duyệt: `db-file-size-browser.ts`, thay vào bởi plugin
import { statSync } from 'node:fs';

/** Cỡ dữ liệu trên đĩa: tệp chính cộng tệp `-wal` (chế độ WAL, xem
 * `open-database.ts`), vì các thay đổi chưa gộp vẫn nằm trong tệp `-wal`. */
export function dbFileBytes(dbPath: string): number {
  if (dbPath === ':memory:') return 0;
  return sizeOf(dbPath) + sizeOf(`${dbPath}-wal`);
}

function sizeOf(filePath: string): number {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}


