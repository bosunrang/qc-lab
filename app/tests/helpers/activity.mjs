// Đọc nhật ký mới nhất trước để test đối chiếu dòng audit. Trước 2026-09-26
// các test mượn `config.listActivity()`, một kênh IPC không còn màn nào gọi
// nhưng đọc được nhật ký mà không cần quyền admin — kênh đó đã bị xoá.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { rowToAuditEntry } = require('../../../app-dist/main/ipc/shared.js');

export function listActivity(db, limit = 200) {
  return db.prepare('SELECT * FROM activity ORDER BY seq DESC LIMIT ?').all(limit).map(rowToAuditEntry);
}
