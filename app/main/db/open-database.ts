import { DatabaseSync } from 'node:sqlite';
import { applySchema, seedInitialRows } from './schema';
import type { SqliteLike } from './sqlite-like';

// `Db` được khai ở `sqlite-like.ts` (hợp đồng cấu trúc, không phụ thuộc
// `node:sqlite`) và re-export ở đây để 16 file handler cũ không phải đổi
// đường import. Xem comment đầu `sqlite-like.ts` để biết vì sao phải tách.
export type { Db } from './sqlite-like';

/** Mở (hoặc tạo mới) file SQLite tại `filePath`, áp schema, trả về kết nối. */
export function openDatabase(filePath: string): SqliteLike {
  const db = new DatabaseSync(filePath);
  // Kiểm tra tĩnh: nếu `node:sqlite` đổi chữ ký khiến `DatabaseSync` không
  // còn khớp `SqliteLike`, `tsc` báo NGAY ở dòng này thay vì để bản xem
  // trước qua trình duyệt âm thầm lệch với bản Electron thật.
  const conn: SqliteLike = db;
  applySchema(conn);
  seedInitialRows(conn);
  return conn;
}


