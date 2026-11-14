import { join } from 'node:path';
import type { Db } from './sqlite-like';
import { applySchema, seedInitialRows } from './schema';
import { withTransaction } from './transaction';
import { quoteIdent, quoteIdents } from './sql-ident';
import { auditEntryHash, verifyAuditChain } from '../domain/audit-chain';
import { rowToAuditEntry } from './audit-row';

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
  /** `seq` (trước phục hồi) của dòng nhật ký đầu tiên trên máy này làm chuỗi
   * hash hỏng; `null` nếu chuỗi nguyên vẹn. Từ dòng đó trở đi, các dòng nối
   * thêm giữ nguyên hash gốc thay vì được tính lại (A27). */
  localChainBrokenAt: number | null;
  /** `seq` của dòng đầu tiên làm chuỗi hash của BẢN SAO LƯU hỏng; `null` nếu
   * nguyên vẹn. Dòng của bản sao lưu được chép nguyên văn nên chỗ hỏng vẫn
   * phát hiện được sau phục hồi. */
  sourceChainBrokenAt: number | null;
}

/** Ghi chú cho dòng nhật ký "Phục hồi…" khi một trong hai chuỗi hash hỏng. */
export function chainWarningNote(outcome: RestoreOutcome): string {
  const notes: string[] = [];
  if (outcome.sourceChainBrokenAt != null) notes.push(`chuỗi hash nhật ký của dữ liệu phục hồi hỏng từ dòng số ${outcome.sourceChainBrokenAt}`);
  if (outcome.localChainBrokenAt != null) notes.push(`chuỗi hash nhật ký của máy này hỏng từ dòng số ${outcome.localChainBrokenAt}, các dòng từ đó giữ nguyên hash gốc`);
  return notes.length ? ` · CẢNH BÁO: ${notes.join('; ')}` : '';
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

/** Bảng hồ sơ mà chế độ vận hành không cho phục hồi xoá cứng (A26, đánh giá
 * 09/11/2026). Đây là hồ sơ chỉ ghi thêm hoặc hồ sơ quyết định: mất
 * `nce_cuts` thì chuỗi Westgard không còn bắt đầu lại sau sự cố và kết luận
 * các lần chạy sau đổi hồi tố; mất `period_locks` thì tháng đã khoá tự mở;
 * mất `qc_month_reviews` là mất chữ ký biên bản. `version`: cột khoá lạc
 * quan — dòng có ở cả hai phía nhưng bản nguồn cũ hơn (vd hồ sơ NCE đã đóng ở
 * đây, còn mở trong bản sao lưu) cũng tính là mất. Bảng danh mục/cấu hình
 * không nằm ở đây: chúng đổi qua các màn hình cấu hình, có nhật ký riêng. */
const PROTECTED_RECORD_TABLES: readonly { table: string; label: string; version?: string }[] = [
  { table: 'lis_imports', label: 'dấu vết nhận bản tin LIS' },
  { table: 'nce_records', label: 'hồ sơ NCE', version: 'row_version' },
  { table: 'nce_runs', label: 'lần chạy gắn hồ sơ NCE' },
  { table: 'nce_actions', label: 'hành động khắc phục' },
  { table: 'nce_decisions', label: 'quyết định NCE' },
  { table: 'nce_revisions', label: 'lần sửa hồ sơ NCE' },
  { table: 'nce_cuts', label: 'mốc bắt đầu lại chuỗi Westgard' },
  { table: 'actions', label: 'hồ sơ khắc phục phiên bản cũ' },
  { table: 'period_locks', label: 'kỳ đã khoá' },
  { table: 'qc_month_reviews', label: 'chữ ký biên bản tháng' },
  { table: 'rule_config_history', label: 'phiên bản cấu hình luật' },
  { table: 'tea_ref_versions', label: 'phiên bản hồ sơ TEa' },
  { table: 'eqa_rounds', label: 'đợt ngoại kiểm', version: 'row_version' },
  { table: 'eqa_results', label: 'kết quả ngoại kiểm' },
  { table: 'eqa_decisions', label: 'quyết định ngoại kiểm' },
];

export interface RestoreLoss { table: string; label: string; count: number }

/** Số dòng của một bảng hồ sơ sẽ mất nếu thay bằng `source`: dòng không có
 * trong nguồn (theo `id`), hoặc có mà phiên bản nguồn cũ hơn. */
function recordRowsLost(db: Db, source: RestoreSource, table: string, version: string | undefined, sourceTables: Set<string>): number {
  if (!sourceTables.has(table)) return Number((db.prepare(`SELECT COUNT(*) AS n FROM main.${quoteIdent(table)}`).get() as { n: number }).n);
  if (source.kind === 'sqlite') {
    const sourceCols = new Set((db.prepare(`PRAGMA backup_src.table_info(${quoteIdent(table)})`).all() as { name: string }[]).map((c) => c.name));
    // Bản sao lưu cũ chưa có cột phiên bản: chỉ so có/không.
    const newer = version && sourceCols.has(version) ? ` AND b.${quoteIdent(version)}>=m.${quoteIdent(version)}` : '';
    return Number((db.prepare(`SELECT COUNT(*) AS n FROM main.${quoteIdent(table)} m WHERE NOT EXISTS (SELECT 1 FROM backup_src.${quoteIdent(table)} b WHERE b.id=m.id${newer})`).get() as { n: number }).n);
  }
  const rows = source.data[table] ?? [];
  const incoming = new Map(rows.map((row) => [String(row.id), version && row[version] != null ? Number(row[version]) : null]));
  const current = db.prepare(`SELECT id${version ? `, ${quoteIdent(version)} AS v` : ''} FROM main.${quoteIdent(table)}`).all() as { id: string; v?: number }[];
  return current.filter((row) => {
    if (!incoming.has(row.id)) return true;
    const sourceVersion = incoming.get(row.id);
    return sourceVersion != null && row.v != null && sourceVersion < Number(row.v);
  }).length;
}

/** Mọi hồ sơ đang có sẽ mất nếu thay toàn bộ dữ liệu bằng `source` — điểm QC
 * (kể cả mất dấu huỷ) và các bảng hồ sơ ở `PROTECTED_RECORD_TABLES`. Chỉ
 * liệt kê bảng có mất mát. Với tệp SQLite phải gọi bên trong `withRestoreSource()`. */
export function recordsLostByRestore(db: Db, source: RestoreSource): RestoreLoss[] {
  const out: RestoreLoss[] = [];
  const points = qcPointsLostByRestore(db, source);
  if (points > 0) out.push({ table: 'qc_points', label: 'điểm QC', count: points });
  const sourceTables = sourceTableNames(db, source);
  const localTables = new Set(listTableNames(db));
  for (const { table, label, version } of PROTECTED_RECORD_TABLES) {
    if (!localTables.has(table)) continue;
    const count = recordRowsLost(db, source, table, version, sourceTables);
    if (count > 0) out.push({ table, label, count });
  }
  return out;
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
 * của bản sao lưu, giống cách gộp nhật ký khi đồng bộ.
 *
 * Chỉ nối lại phần chuỗi CÒN NGUYÊN VẸN (A27): nếu nhật ký của máy đã bị sửa
 * tay, tính lại hash cho dòng bị sửa sẽ "rửa" nó thành hợp lệ. Từ dòng hỏng
 * đầu tiên (`brokenId`) trở đi, dòng nối thêm giữ nguyên `prev_hash`/`hash`
 * gốc nên kiểm tra chuỗi sau phục hồi vẫn chỉ ra chỗ hỏng. */
function appendPreviousActivity(db: Db, brokenId: string | null): number {
  const rows = db.prepare(`SELECT * FROM temp.restore_prev_activity p
    WHERE NOT EXISTS (SELECT 1 FROM main.activity a WHERE a.id=p.id) ORDER BY p.seq`).all() as Record<string, unknown>[];
  if (!rows.length) return 0;
  const brokenSeq = brokenId == null ? null
    : Number((db.prepare('SELECT seq FROM temp.restore_prev_activity WHERE id=?').get(brokenId) as { seq: number } | undefined)?.seq ?? NaN);
  const last = db.prepare("SELECT hash FROM main.activity WHERE hash<>'' ORDER BY seq DESC LIMIT 1").get() as { hash: string } | undefined;
  const anchor = db.prepare("SELECT value FROM main.app_meta WHERE key='activityAnchor'").get() as { value: string } | undefined;
  let previous = last?.hash ?? anchor?.value ?? '';
  let seq = Number((db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM main.activity').get() as { n: number }).n);
  const insert = db.prepare(`INSERT INTO main.activity(id,seq,ts,user,username,user_id,role,type,detail,target,client_id,prev_hash,hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const row of rows) {
    const entry = rowToAuditEntry(row);
    entry.seq = ++seq;
    const untrusted = brokenSeq != null && !(Number(row.seq) < brokenSeq);
    // Dòng chưa từng có hash (dữ liệu rất cũ) giữ nguyên, như `relinkAuditChain`.
    if ((entry.hash || entry.prevHash) && !untrusted) {
      entry.prevHash = previous;
      entry.hash = auditEntryHash(entry);
      previous = entry.hash;
    }
    insert.run(entry.id, entry.seq, entry.ts, entry.user, entry.username, entry.userId, entry.role, entry.type, entry.detail,
      entry.target, entry.clientId, entry.prevHash, entry.hash);
  }
  return rows.length;
}

/** Nhật ký cần kiểm: bảng sống `main.activity` hoặc bản chụp của máy này
 * trước phục hồi. Câu SQL viết sẵn, không ghép tên bảng. */
const AUDIT_ROWS_SQL = {
  main: 'SELECT * FROM main.activity ORDER BY seq',
  previous: 'SELECT * FROM temp.restore_prev_activity ORDER BY seq',
} as const;

/** Dòng đầu tiên làm chuỗi hash hỏng (đọc theo `seq`), tính từ `anchor`;
 * `null` nếu nguyên vẹn. */
function firstBrokenAuditRow(db: Db, which: keyof typeof AUDIT_ROWS_SQL, anchor: string): { id: string; seq: number } | null {
  const rows = (db.prepare(AUDIT_ROWS_SQL[which]).all() as Record<string, unknown>[]).map(rowToAuditEntry);
  const result = verifyAuditChain(rows, anchor);
  if (result.ok) return null;
  const broken = rows[result.brokenIndex];
  return broken ? { id: broken.id, seq: broken.seq } : null;
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
    let localBroken: { id: string; seq: number } | null = null;
    if (mergeActivity) {
      db.exec(`DROP TABLE IF EXISTS temp.restore_prev_activity`);
      db.exec(`CREATE TEMP TABLE restore_prev_activity AS SELECT * FROM main.activity`);
      // Kiểm chuỗi của máy này TRƯỚC khi app_meta (chứa anchor) bị thay.
      localBroken = firstBrokenAuditRow(db, 'previous', activityAnchorOf(db));
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
    let keptActivity = 0, sourceBroken: { id: string; seq: number } | null = null;
    if (mergeActivity) {
      // Nhật ký của nguồn được chép nguyên văn: chỗ hỏng (nếu có) vẫn còn đó
      // để kiểm tra chuỗi phát hiện; ở đây chỉ ghi nhận để báo trong nhật ký.
      sourceBroken = firstBrokenAuditRow(db, 'main', activityAnchorOf(db));
      keptActivity = appendPreviousActivity(db, localBroken?.id ?? null);
      db.exec(`DROP TABLE temp.restore_prev_activity`);
    }
    const violations = db.prepare('PRAGMA main.foreign_key_check').all();
    if (violations.length) throw new Error(`Dữ liệu vi phạm ràng buộc khoá ngoại (${violations.length} dòng) — huỷ thao tác.`);
    return { keptActivity, localChainBrokenAt: localBroken?.seq ?? null, sourceChainBrokenAt: sourceBroken?.seq ?? null };
  });
}

function activityAnchorOf(db: Db): string {
  return (db.prepare("SELECT value FROM main.app_meta WHERE key='activityAnchor'").get() as { value: string } | undefined)?.value ?? '';
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
