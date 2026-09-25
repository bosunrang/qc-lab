import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './sqlite-like';
import { SCHEMA_VERSION, applySchema } from './schema';
import { buildBackupEnvelope } from '../domain/backup';

export function listTableNames(db: Db): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map((r) => r.name);
}

export function columnsOf(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((r) => r.name);
}

export function dumpAllTables(db: Db): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of listTableNames(db)) {
    out[table] = db.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
  }
  return out;
}

/** Chốt một bản sao an toàn trước khi thay thế toàn bộ dữ liệu. */
export function writeSafetySnapshot(db: Db, userDataDir: string, filePrefix: string): string {
  const envelope = buildBackupEnvelope(dumpAllTables(db), SCHEMA_VERSION, 'app', new Date().toISOString());
  const path = join(userDataDir, `${filePrefix}-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(envelope), 'utf8');
  return path;
}

/** Thay thế toàn bộ bảng bằng dữ liệu đã kiểm tra trong một transaction. */
export function restoreAllTables(db: Db, dataByTable: Record<string, Record<string, unknown>[] | undefined>): void {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    const tables = listTableNames(db);
    // Xoá theo thứ tự NGƯỢC LIỆT KÊ để giảm khả năng đụng ràng buộc dù đã
    // tắt foreign_keys (phòng thủ 2 lớp, không phụ thuộc mỗi PRAGMA).
    for (const table of [...tables].reverse()) db.exec(`DELETE FROM ${table}`);
    for (const table of tables) {
      const rows = dataByTable[table];
      if (!rows || !rows.length) continue;
      // Chỉ chèn cột có trong dữ liệu: backup cũ chưa có các cột thêm sau, gán
      // NULL tường minh sẽ vỡ ràng buộc NOT NULL (ví dụ `users.avatar`), còn bỏ
      // qua thì cột nhận giá trị mặc định của schema hiện tại.
      const cols = columnsOf(db, table).filter((c) => c in rows[0]);
      if (!cols.length) continue;
      const placeholders = cols.map(() => '?').join(',');
      const stmt = db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES (${placeholders})`);
      for (const row of rows) {
        const values = cols.map((c) => (row[c] === undefined ? null : row[c])) as (string | number | bigint | null)[];
        stmt.run(...values);
      }
    }
    // Dữ liệu phục hồi mang số phiên bản schema của lúc xuất: chạy các bước
    // migration còn thiếu ngay trong transaction này, để dữ liệu cũ được chuẩn
    // hoá luôn và một bản không nâng cấp được thì huỷ cả lần phục hồi.
    applySchema(db);
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) throw new Error(`Dữ liệu vi phạm ràng buộc khoá ngoại (${violations.length} dòng) — huỷ thao tác.`);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* giữ lỗi gốc */ }
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}


