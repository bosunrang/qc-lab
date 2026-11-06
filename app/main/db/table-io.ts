import { join } from 'node:path';
import type { Db } from './sqlite-like';
import { applySchema, seedInitialRows } from './schema';
import { withTransaction } from './transaction';
import { quoteIdent, quoteIdents } from './sql-ident';
import { auditEntryHash } from '../domain/audit-chain';

export function listTableNames(db: Db): string[] {
  return (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[])
    .map((r) => r.name);
}

export function columnsOf(db: Db, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as { name: string }[]).map((r) => r.name);
}

export function dumpAllTables(db: Db): Record<string, Record<string, unknown>[]> {
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const table of listTableNames(db)) {
    out[table] = db.prepare(`SELECT * FROM ${quoteIdent(table)}`).all() as Record<string, unknown>[];
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

export type TableData = Record<string, Record<string, unknown>[] | undefined>;

/** Nguồn phục hồi: dữ liệu đã đọc (bản JSON cũ, gói Firebase) hoặc tệp SQLite
 * đã kiểm tra. Tệp SQLite được chép ngay trong SQLite qua ATTACH, không đi
 * qua bộ nhớ JavaScript. */
export type RestoreSource = { kind: 'json'; data: TableData } | { kind: 'sqlite'; filePath: string };

export interface RestoreOptions {
  /** Bảng giữ nguyên dữ liệu hiện có (không xoá, không chép từ bản sao lưu)
   * — vd `users` khi người dùng chọn giữ tài khoản của máy này. */
  keep?: readonly string[];
  /** Khoá `app_meta` của riêng máy này, giữ giá trị hiện có thay vì lấy theo
   * bản sao lưu (kết nối Firebase, cấu hình LIS kèm token). */
  keepMetaKeys?: readonly string[];
}

export interface RestoreOutcome {
  /** Số dòng nhật ký của máy này không có trong bản sao lưu, đã được nối
   * tiếp vào sau nhật ký của bản sao lưu. */
  keptActivity: number;
}


/** Chuẩn bị kết nối cho một lần phục hồi rồi chạy `work`: tắt khoá ngoại và,
 * với tệp SQLite, ATTACH tệp nguồn. Cả hai chỉ làm được NGOÀI transaction,
 * nên phần ghi (kể cả `w.commit()` của cổng ghi) nằm bên trong `work`. */
export function withRestoreSource<T>(db: Db, source: RestoreSource, work: () => T): T {
  db.exec('PRAGMA foreign_keys = OFF');
  let attached = false;
  try {
    if (source.kind === 'sqlite') {
      db.prepare(`ATTACH DATABASE ? AS backup_src`).run(source.filePath);
      attached = true;
    }
    return work();
  } finally {
    if (attached) db.exec(`DETACH DATABASE backup_src`);
    db.exec('PRAGMA foreign_keys = ON');
  }
}

function sourceTableNames(db: Db, source: RestoreSource): Set<string> {
  if (source.kind === 'json') return new Set(Object.keys(source.data));
  return new Set((db.prepare(`SELECT name FROM backup_src.sqlite_master WHERE type='table'`).all() as { name: string }[]).map((r) => r.name));
}

/** Số điểm QC đang có sẽ mất nếu thay toàn bộ dữ liệu bằng `source`: điểm
 * không có trong nguồn, hoặc đã huỷ ở đây mà trong nguồn chưa huỷ (mất dấu vết
 * huỷ). Với tệp SQLite phải gọi bên trong `withRestoreSource()`. */
export function qcPointsLostByRestore(db: Db, source: RestoreSource): number {
  if (!sourceTableNames(db, source).has('qc_points')) {
    return Number((db.prepare('SELECT COUNT(*) AS n FROM main.qc_points').get() as { n: number }).n);
  }
  if (source.kind === 'sqlite') {
    const hasVoided = (db.prepare(`PRAGMA backup_src.table_info(qc_points)`).all() as { name: string }[]).some((c) => c.name === 'voided');
    // Bản sao lưu rất cũ chưa có cột `voided`: mọi điểm trong đó coi như chưa huỷ.
    const sql = hasVoided
      ? 'SELECT COUNT(*) AS n FROM main.qc_points m WHERE NOT EXISTS (SELECT 1 FROM backup_src.qc_points b WHERE b.id=m.id AND (m.voided=0 OR b.voided<>0))'
      : 'SELECT COUNT(*) AS n FROM main.qc_points m WHERE m.voided<>0 OR NOT EXISTS (SELECT 1 FROM backup_src.qc_points b WHERE b.id=m.id)';
    return Number((db.prepare(sql).get() as { n: number }).n);
  }
  const incoming = new Map((source.data.qc_points ?? []).map((row) => [String(row.id), Number(row.voided ?? 0) !== 0]));
  const current = db.prepare('SELECT id, voided FROM main.qc_points').all() as { id: string; voided: number }[];
  return current.filter((row) => !incoming.has(row.id) || (row.voided !== 0 && !incoming.get(row.id))).length;
}

function copyTable(db: Db, source: RestoreSource, table: string, sourceTables: Set<string>): void {
  if (!sourceTables.has(table)) return;
  if (source.kind === 'sqlite') {
    // Chỉ chép cột có ở CẢ HAI phía: cột mới hơn bản sao lưu nhận giá trị
    // mặc định của schema hiện tại; bảng lạ trong tệp (`backup_info`) bị bỏ qua.
    const sourceCols = new Set((db.prepare(`PRAGMA backup_src.table_info(${quoteIdent(table)})`).all() as { name: string }[]).map((r) => r.name));
    const cols = (db.prepare(`PRAGMA main.table_info(${quoteIdent(table)})`).all() as { name: string }[]).map((r) => r.name).filter((c) => sourceCols.has(c));
    if (cols.length) db.exec(`INSERT INTO main.${quoteIdent(table)}(${quoteIdents(cols)}) SELECT ${quoteIdents(cols)} FROM backup_src.${quoteIdent(table)}`);
    return;
  }
  const rows = source.data[table];
  if (!rows || !rows.length) return;
  // Chỉ chèn cột có trong dữ liệu: backup cũ chưa có các cột thêm sau, gán
  // NULL tường minh sẽ vỡ ràng buộc NOT NULL (ví dụ `users.avatar`), còn bỏ
  // qua thì cột nhận giá trị mặc định của schema hiện tại.
  const cols = columnsOf(db, table).filter((c) => c in rows[0]);
  if (!cols.length) return;
  const placeholders = cols.map(() => '?').join(',');
  const stmt = db.prepare(`INSERT INTO main.${quoteIdent(table)}(${quoteIdents(cols)}) VALUES (${placeholders})`);
  for (const row of rows) {
    const values = cols.map((c) => (row[c] === undefined ? null : row[c])) as (string | number | bigint | null)[];
    stmt.run(...values);
  }
}

/** Nối các dòng nhật ký của máy này mà bản sao lưu không có vào SAU nhật ký
 * vừa phục hồi. Nhật ký là hồ sơ chỉ ghi thêm (ISO 15189:2022 8.4): phục hồi
 * dữ liệu không được làm biến mất dấu vết những gì đã xảy ra sau thời điểm
 * sao lưu. Dòng nối thêm được đánh số tiếp và nối lại chuỗi hash từ dòng cuối
 * của bản sao lưu, giống cách gộp nhật ký khi đồng bộ. */
function appendPreviousActivity(db: Db): number {
  const rows = db.prepare(`SELECT * FROM temp.restore_prev_activity p
    WHERE NOT EXISTS (SELECT 1 FROM main.activity a WHERE a.id=p.id) ORDER BY p.seq`).all() as Record<string, unknown>[];
  if (!rows.length) return 0;
  const last = db.prepare("SELECT hash FROM main.activity WHERE hash<>'' ORDER BY seq DESC LIMIT 1").get() as { hash: string } | undefined;
  const anchor = db.prepare("SELECT value FROM main.app_meta WHERE key='activityAnchor'").get() as { value: string } | undefined;
  let previous = last?.hash ?? anchor?.value ?? '';
  let seq = Number((db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM main.activity').get() as { n: number }).n);
  const insert = db.prepare(`INSERT INTO main.activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of rows) {
    const entry = {
      id: String(row.id ?? ''), seq: ++seq, ts: String(row.ts ?? ''), user: String(row.user ?? ''), username: String(row.username ?? ''),
      userId: String(row.user_id ?? ''), role: String(row.role ?? ''), type: String(row.type ?? ''), detail: String(row.detail ?? ''),
      target: String(row.target ?? ''), clientId: String(row.client_id ?? ''), prevHash: String(row.prev_hash ?? ''), hash: String(row.hash ?? ''),
    };
    // Dòng chưa từng có hash (dữ liệu rất cũ) giữ nguyên, như `relinkAuditChain`.
    if (entry.hash || entry.prevHash) {
      entry.prevHash = previous;
      entry.hash = auditEntryHash(entry);
      previous = entry.hash;
    }
    insert.run(entry.id, entry.seq, entry.ts, entry.user, entry.username, entry.userId, entry.role, entry.type, entry.detail,
      entry.target, entry.clientId, entry.prevHash, entry.hash);
  }
  return rows.length;
}

/** Thay toàn bộ bảng bằng `source` trong MỘT transaction (lồng được vào
 * `w.commit()`), phải gọi bên trong `withRestoreSource()`. Nhật ký hoạt động
 * không bị thay mà được gộp: nhật ký của bản sao lưu cộng các dòng của máy
 * này phát sinh sau đó. */
export function replaceAllTables(db: Db, source: RestoreSource, options: RestoreOptions = {}): RestoreOutcome {
  const keep = options.keep ?? [];
  const keepMetaKeys = options.keepMetaKeys ?? [];
  return withTransaction(db, () => {
    const tables = listTableNames(db).filter((table) => !keep.includes(table));
    const sourceTables = sourceTableNames(db, source);
    const mergeActivity = tables.includes('activity');
    if (mergeActivity) {
      db.exec(`DROP TABLE IF EXISTS temp.restore_prev_activity`);
      db.exec(`CREATE TEMP TABLE restore_prev_activity AS SELECT * FROM main.activity`);
    }
    const placeholders = keepMetaKeys.map(() => '?').join(',');
    const localMeta = keepMetaKeys.length
      ? db.prepare(`SELECT key, value FROM main.app_meta WHERE key IN (${placeholders})`).all(...keepMetaKeys) as { key: string; value: string }[]
      : [];
    // Xoá theo thứ tự NGƯỢC LIỆT KÊ để giảm khả năng đụng ràng buộc dù đã
    // tắt foreign_keys (phòng thủ 2 lớp, không phụ thuộc mỗi PRAGMA).
    for (const table of [...tables].reverse()) db.exec(`DELETE FROM main.${quoteIdent(table)}`);
    for (const table of tables) copyTable(db, source, table, sourceTables);
    if (keepMetaKeys.length) {
      db.prepare(`DELETE FROM main.app_meta WHERE key IN (${placeholders})`).run(...keepMetaKeys);
      const insertMeta = db.prepare('INSERT INTO main.app_meta(key,value) VALUES (?,?)');
      for (const row of localMeta) insertMeta.run(row.key, row.value);
    }
    // Dữ liệu phục hồi mang số phiên bản schema của lúc xuất: chạy các bước
    // migration còn thiếu ngay trong transaction này, để dữ liệu cũ được chuẩn
    // hoá luôn và một bản không nâng cấp được thì huỷ cả lần phục hồi.
    applySchema(db);
    seedInitialRows(db);
    let keptActivity = 0;
    if (mergeActivity) {
      keptActivity = appendPreviousActivity(db);
      db.exec(`DROP TABLE temp.restore_prev_activity`);
    }
    const violations = db.prepare('PRAGMA main.foreign_key_check').all();
    if (violations.length) throw new Error(`Dữ liệu vi phạm ràng buộc khoá ngoại (${violations.length} dòng) — huỷ thao tác.`);
    return { keptActivity };
  });
}

/** Thay thế toàn bộ bảng bằng dữ liệu đã kiểm tra trong một transaction. */
export function restoreAllTables(db: Db, dataByTable: TableData, keep: readonly string[] = []): RestoreOutcome {
  const source: RestoreSource = { kind: 'json', data: dataByTable };
  return withRestoreSource(db, source, () => replaceAllTables(db, source, { keep }));
}

/** Thay thế toàn bộ bảng bằng dữ liệu của một tệp SQLite khác (bản backup đã
 * kiểm tra), xem `replaceAllTables()`. */
export function restoreAllTablesFromFile(db: Db, filePath: string, keep: readonly string[] = []): RestoreOutcome {
  const source: RestoreSource = { kind: 'sqlite', filePath };
  return withRestoreSource(db, source, () => replaceAllTables(db, source, { keep }));
}
