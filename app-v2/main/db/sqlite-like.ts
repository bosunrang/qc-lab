// Hợp đồng CẤU TRÚC (structural) tối thiểu giữa mọi handler `main/ipc/*` và
// một kết nối SQLite — cố ý KHÔNG import `node:sqlite`.
//
// Lý do tách file này ra khỏi `open-database.ts` (2026-09-09): bản xem trước
// qua trình duyệt (`npm run app-v2:dev`) cần chạy CHÍNH các handler thật trên
// một SQLite khác (sql.js/WASM) thay vì một bản giả lập viết tay song song —
// xem `renderer/browser-mock/sqlite-shim.ts`. Nếu 16 file handler vẫn
// `import type { Db } from './open-database'` thì `tsc` của renderer buộc
// phải resolve tới `node:sqlite`, thứ không tồn tại trong trình duyệt.
//
// Bề mặt này là ĐÚNG những gì handler thật đang dùng, đo bằng grep toàn bộ
// `main/ipc` + `main/db`: `db.prepare()` (321 chỗ) và `db.exec()` (68 chỗ);
// trên statement chỉ có `.get()` (118), `.run()` (56), `.all()` (43). Thêm
// method mới vào đây nghĩa là `sqlite-shim.ts` cũng phải cài đặt thêm — giữ
// bề mặt nhỏ là điều kiện để bản xem trước không tụt lại sau bản thật.

/** Kết quả của một câu lệnh ghi. Chỉ `changes` được dùng thật (2 chỗ trong
 * `config-handlers.ts`); `lastInsertRowid` giữ cho khớp `node:sqlite` vì mọi
 * bảng ở đây dùng khoá TEXT tự sinh, không AUTOINCREMENT. */
export interface SqliteRunResult {
  /** `node:sqlite` trả `number | bigint` (bigint khi vượt Number.MAX_SAFE_INTEGER),
   * nên hợp đồng phải khai đúng cả hai — mọi chỗ đọc phải tự bọc `Number()`.
   * Khai hẹp thành `number` sẽ khiến `const conn: SqliteLike = db` trong
   * `open-database.ts` không biên dịch được. */
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface SqliteStatementLike {
  /** Dòng đầu tiên, hoặc `undefined` nếu truy vấn không trả dòng nào. */
  get(...params: any[]): any;
  /** Toàn bộ dòng. */
  all(...params: any[]): any[];
  run(...params: any[]): SqliteRunResult;
}

export interface SqliteLike {
  prepare(sql: string): SqliteStatementLike;
  /** Chạy SQL thô, có thể nhiều câu lệnh (schema, PRAGMA, BEGIN/COMMIT). */
  exec(sql: string): void;
}

/** Kiểu `db` mà mọi handler nhận. */
export type Db = SqliteLike;
