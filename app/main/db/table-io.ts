import { join } from 'node:path';
import type { Db } from './sqlite-like';

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

/** Chép nguyên CSDL ra một tệp SQLite mới. `VACUUM INTO` do SQLite tự làm
 * theo từng trang, không dựng dữ liệu thành chuỗi trong bộ nhớ như bản JSON
 * cũ (từng phình quá 128 MB ở khoảng 175.000 điểm QC). Không chạy được bên
 * trong transaction, và tệp đích phải chưa tồn tại. */
export function vacuumInto(db: Db, filePath: string): void {
  db.prepare('VACUUM INTO ?').run(filePath);
}

/** Chốt một bản sao an toàn trước khi thay thế toàn bộ dữ liệu. */
export function writeSafetySnapshot(db: Db, userDataDir: string, filePrefix: string): string {
  const path = join(userDataDir, `${filePrefix}-${Date.now()}.sqlite`);
  vacuumInto(db, path);
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

/** Thay thế toàn bộ bảng bằng dữ liệu của một tệp SQLite khác (bản backup đã
 * kiểm tra). Dữ liệu chép ngay trong SQLite qua ATTACH, không đi qua bộ nhớ
 * JavaScript. Chỉ chép các bảng và cột có ở CẢ HAI phía: bảng lạ trong tệp
 * (như `backup_info`) bị bỏ qua; cột mới hơn bản backup nhận giá trị mặc định
 * của schema hiện tại. */
export function restoreAllTablesFromFile(db: Db, filePath: string): void {
  db.exec('PRAGMA foreign_keys = OFF');
  db.prepare('ATTACH DATABASE ? AS backup_src').run(filePath);
  try {
    db.exec('BEGIN');
    try {
      const tables = listTableNames(db);
      const sourceTables = new Set((db.prepare("SELECT name FROM backup_src.sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name));
      for (const table of [...tables].reverse()) db.exec(`DELETE FROM main.${table}`);
      for (const table of tables) {
        if (!sourceTables.has(table)) continue;
        const sourceCols = new Set((db.prepare(`PRAGMA backup_src.table_info(${table})`).all() as { name: string }[]).map((r) => r.name));
        const cols = (db.prepare(`PRAGMA main.table_info(${table})`).all() as { name: string }[]).map((r) => r.name).filter((c) => sourceCols.has(c));
        if (!cols.length) continue;
        db.exec(`INSERT INTO main.${table}(${cols.join(',')}) SELECT ${cols.join(',')} FROM backup_src.${table}`);
      }
      const violations = db.prepare('PRAGMA main.foreign_key_check').all();
      if (violations.length) throw new Error(`Dữ liệu vi phạm ràng buộc khoá ngoại (${violations.length} dòng) — huỷ thao tác.`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  } finally {
    db.exec('DETACH DATABASE backup_src');
    db.exec('PRAGMA foreign_keys = ON');
  }
}
