// Đọc/ghi TOÀN BỘ bảng SQLite một cách TỔNG QUÁT qua `sqlite_master`/
// `PRAGMA table_info` — không hard-code danh sách bảng/cột, để không lệch
// mỗi khi schema.ts thêm bảng/cột mới. Tách ra từ `ipc/backup-handlers.ts`
// (Giai đoạn C3) khi Giai đoạn C4 (di trú dữ liệu từ app cũ) cần DÙNG LẠI
// đúng transaction phục hồi đó cho một nguồn dữ liệu khác (đã ánh xạ từ
// định dạng app cũ), không phải chép lại lần hai.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Db } from './open-database';
import { SCHEMA_VERSION } from './schema';
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

/** Tự động chốt 1 bản backup "trước khi thay đổi" ra đĩa thật TRƯỚC khi xoá
 * bất cứ gì — dùng chung cho cả phục hồi backup app-v2 (C3) lẫn di trú dữ
 * liệu từ app cũ (C4), cả hai đều là thao tác THAY THẾ TOÀN BỘ dữ liệu nên
 * cùng cần đúng 1 đường lùi này. */
export function writeSafetySnapshot(db: Db, userDataDir: string, filePrefix: string): string {
  const envelope = buildBackupEnvelope(dumpAllTables(db), SCHEMA_VERSION, 'app-v2', new Date().toISOString());
  const path = join(userDataDir, `${filePrefix}-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(envelope), 'utf8');
  return path;
}

/** Xoá TOÀN BỘ bảng rồi nạp lại từ `dataByTable` trong 1 transaction thật —
 * dùng chung cho cả phục hồi backup CÙNG định dạng (C3) lẫn nạp dữ liệu đã
 * ÁNH XẠ từ định dạng khác (C4, di trú từ app cũ). `dataByTable` chỉ cần có
 * đúng tên bảng/cột hiện tại — bảng không có trong `dataByTable` chỉ bị xoá
 * rỗng (không lỗi), đúng ngữ nghĩa "thay thế toàn bộ". */
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
      const cols = columnsOf(db, table);
      const placeholders = cols.map(() => '?').join(',');
      const stmt = db.prepare(`INSERT INTO ${table}(${cols.join(',')}) VALUES (${placeholders})`);
      for (const row of rows) {
        const values = cols.map((c) => (row[c] === undefined ? null : row[c])) as (string | number | bigint | null)[];
        stmt.run(...values);
      }
    }
    const violations = db.prepare('PRAGMA foreign_key_check').all();
    if (violations.length) throw new Error(`Dữ liệu vi phạm ràng buộc khoá ngoại (${violations.length} dòng) — huỷ thao tác.`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
