import { DatabaseSync } from 'node:sqlite';
import { applySchema, seedInitialRows } from './schema';
import type { SqliteLike } from './sqlite-like';

// `Db` được khai ở `sqlite-like.ts` (hợp đồng cấu trúc, không phụ thuộc
// `node:sqlite`) và re-export ở đây để 16 file handler cũ không phải đổi
// đường import. Xem comment đầu `sqlite-like.ts` để biết vì sao phải tách.
export type { Db } from './sqlite-like';

/** Mở (hoặc tạo mới) file SQLite tại `filePath`, áp schema, trả về kết nối.
 * Người gọi `close()` khi thoát app để SQLite gộp tệp `-wal` vào tệp chính. */
export function openDatabase(filePath: string): SqliteLike & { close(): void } {
  const db = new DatabaseSync(filePath);
  // Kiểm tra tĩnh: nếu `node:sqlite` đổi chữ ký khiến `DatabaseSync` không
  // còn khớp `SqliteLike`, `tsc` báo NGAY ở dòng này thay vì để bản xem
  // trước qua trình duyệt âm thầm lệch với bản Electron thật.
  const conn: SqliteLike = db;
  // WAL: mỗi lần ghi chỉ đồng bộ tệp `-wal` một lần thay vì ghi journal rồi
  // ghi đè tệp chính (đo 2026-09-26: 11 ms → 3 ms mỗi thao tác ghi có nhật
  // ký), và là điều kiện để về sau mở thêm kết nối chỉ đọc chạy song song.
  // Giữ `synchronous = FULL` để mất điện không mất thao tác đã báo thành công;
  // `NORMAL` nhanh hơn nữa nhưng có thể mất vài giao dịch cuối khi mất điện.
  // CSDL trong bộ nhớ (test) trả về 'memory' và bỏ qua lệnh này.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = FULL');
  applySchema(conn);
  seedInitialRows(conn);
  return db;
}

/** Mở một tệp SQLite có sẵn mà KHÔNG áp schema: đọc tệp backup trước khi phục
 * hồi (`readOnly`, không sửa gì trong tệp) hoặc ghi phần mô tả vào bản backup
 * vừa tạo. Người gọi phải `close()` để Windows nhả khoá tệp. */
export function openExistingDatabase(filePath: string, options: { readOnly: boolean }): SqliteLike & { close(): void } {
  return new DatabaseSync(filePath, { readOnly: options.readOnly, open: true });
}


