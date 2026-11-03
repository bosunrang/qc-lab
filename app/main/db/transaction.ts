import type { SqliteLike } from './sqlite-like';

let savepointSeq = 0;
const openDepth = new WeakMap<SqliteLike, number>();

/** Đang ở bên trong `withTransaction()` của kết nối này — dữ liệu đọc được
 * lúc này có thể bị huỷ theo, nên bộ nhớ đệm không được giữ lại. */
export function inTransaction(db: SqliteLike): boolean {
  return (openDepth.get(db) ?? 0) > 0;
}

/** Chạy `work` nguyên tử: lỗi ở bất kỳ bước nào thì mọi thay đổi bên trong bị
 * huỷ, kể cả dòng nhật ký. Dùng SAVEPOINT thay vì BEGIN để lồng được — gọi
 * bên trong một transaction đang mở (hoặc bên trong `writeAudit`) vẫn đúng.
 * ROLLBACK được bọc riêng để lỗi của nó không đè mất lỗi gốc.
 *
 * `work` phải đồng bộ: SQLite ở đây chạy đồng bộ, một `await` giữa chừng sẽ
 * để transaction mở trong khi lệnh khác chen vào. */
export function withTransaction<T>(db: SqliteLike, work: () => T): T {
  const name = `tx_${++savepointSeq}`;
  db.exec(`SAVEPOINT ${name}`);
  openDepth.set(db, (openDepth.get(db) ?? 0) + 1);
  try {
    const result = work();
    if (result && typeof (result as { then?: unknown }).then === 'function') {
      throw new Error('withTransaction chỉ nhận hàm đồng bộ.');
    }
    db.exec(`RELEASE ${name}`);
    return result;
  } catch (error) {
    try {
      db.exec(`ROLLBACK TO ${name}`);
      db.exec(`RELEASE ${name}`);
    } catch { /* giữ lỗi gốc */ }
    throw error;
  } finally {
    openDepth.set(db, (openDepth.get(db) ?? 1) - 1);
  }
}
