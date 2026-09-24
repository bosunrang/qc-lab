// Đo "kích thước database" — bản TRÌNH DUYỆT (xem `db-file-size.ts`).
//
// Không có file trên đĩa: bản xem trước giữ database trong IndexedDB dưới
// dạng một ảnh nhị phân. Kích thước thật được `real-api.ts` đăng ký qua
// `setBrowserDbSizeSource()` (nó nắm `db.export()`), nên hàm này không cần
// biết gì về sql.js.
let source: (() => number) | null = null;

export function setBrowserDbSizeSource(fn: () => number): void {
  source = fn;
}

export function dbFileBytes(_dbPath: string): number {
  void _dbPath;
  return source ? source() : 0;
}


