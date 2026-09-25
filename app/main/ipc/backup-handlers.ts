// Xuất, kiểm tra và phục hồi dữ liệu của QC Lab.
//
// Tệp backup là một tệp SQLite (xem `BACKUP_FILE_FORMAT`). Trước 2026-09-25
// backup là một chuỗi JSON dựng toàn bộ CSDL trong bộ nhớ và bị chặn ở 128 MB
// khi nhập lại — khoảng 175.000 điểm QC kèm nhật ký, tức vài năm dữ liệu của
// một phòng xét nghiệm. Tệp .json cũ vẫn phục hồi được (giữ ngưỡng 128 MB
// riêng cho đường này). Các hàm ở đây làm việc với ĐƯỜNG DẪN TỆP; hộp thoại
// chọn tệp do main process mở (index.ts), renderer không truyền nội dung tệp.
import { closeSync, existsSync, openSync, readFileSync, readSync, renameSync, statSync, unlinkSync } from 'node:fs';
import type { Db } from '../db/sqlite-like';
import { SCHEMA_VERSION } from '../db/schema';
import { openExistingDatabase } from '../db/open-database';
import { listTableNames, restoreAllTables, restoreAllTablesFromFile, vacuumInto, writeSafetySnapshot } from '../db/table-io';
import { BACKUP_FILE_FORMAT, BACKUP_FILE_FORMAT_VERSION, validateBackupEnvelope, type BackupEnvelope } from '../domain/backup';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireAdmin } from './shared';

/** Ngưỡng chỉ còn áp cho tệp backup JSON cũ: phải đọc cả tệp thành chuỗi. */
const LEGACY_JSON_MAX_BYTES = 128 * 1024 * 1024;
const SQLITE_HEADER = 'SQLite format 3\u0000';

export interface BackupFileSummary {
  tables: number;
  rows: number;
  points: number;
  schemaVersion: number;
  createdAt: string;
  bytes: number;
  /** `true` khi tệp là backup JSON cũ. */
  legacy: boolean;
}

type Inspected =
  | { ok: true; kind: 'sqlite'; summary: BackupFileSummary }
  | { ok: true; kind: 'json'; summary: BackupFileSummary; envelope: BackupEnvelope }
  | { ok: false; code: string; message: string };

function fail<T>(code: string, message: string): IpcResult<T> {
  return { ok: false, error: { code, message } };
}

function readHeader(filePath: string): string {
  const fd = openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(16);
    const read = readSync(fd, buffer, 0, 16, 0);
    return buffer.subarray(0, read).toString('latin1');
  } finally {
    closeSync(fd);
  }
}

/** Kiểm tra một tệp backup mà không chạm vào CSDL đang dùng. */
function inspectBackupFile(filePath: string): Inspected {
  if (!filePath || !existsSync(filePath)) return { ok: false, code: 'not-found', message: 'Không tìm thấy tệp backup.' };
  const bytes = statSync(filePath).size;
  const header = readHeader(filePath);
  if (header === SQLITE_HEADER) return inspectSqliteBackup(filePath, bytes);
  if (header.trimStart().startsWith('{')) return inspectJsonBackup(filePath, bytes);
  return { ok: false, code: 'wrong-format', message: 'Tệp này không phải backup của QC Lab.' };
}

function inspectSqliteBackup(filePath: string, bytes: number): Inspected {
  let source: ReturnType<typeof openExistingDatabase>;
  try {
    source = openExistingDatabase(filePath, { readOnly: true });
  } catch {
    return { ok: false, code: 'corrupt', message: 'Không mở được tệp backup — tệp có thể đã hỏng.' };
  }
  try {
    // Kiểm tra toàn vẹn TRƯỚC: trang hỏng có thể trúng ngay bảng mô tả, và khi
    // đó phải báo "tệp hỏng" chứ không phải "sai định dạng".
    let integrity: { integrity_check: string }[];
    try {
      integrity = source.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
    } catch {
      integrity = [];
    }
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
      return { ok: false, code: 'corrupt', message: 'Tệp backup không vượt qua kiểm tra toàn vẹn của SQLite — tệp có thể đã hỏng.' };
    }
    const info = new Map<string, string>();
    try {
      for (const row of source.prepare('SELECT key, value FROM backup_info').all() as { key: string; value: string }[]) info.set(row.key, row.value);
    } catch {
      return { ok: false, code: 'wrong-format', message: 'Tệp SQLite này không phải backup của QC Lab (thiếu phần mô tả backup).' };
    }
    if (info.get('format') !== BACKUP_FILE_FORMAT) {
      return { ok: false, code: 'wrong-format', message: `Tệp này không đúng định dạng backup được hỗ trợ (format="${info.get('format') ?? ''}").` };
    }
    const schemaVersion = Number(info.get('schemaVersion'));
    if (!Number.isInteger(schemaVersion) || schemaVersion > SCHEMA_VERSION) {
      return { ok: false, code: 'unsupported-schema', message: 'Backup được tạo từ phiên bản mới hơn app hiện tại, không thể phục hồi.' };
    }
    const tables = (source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'backup_info'").all() as { name: string }[]).map((r) => r.name);
    let rows = 0;
    for (const table of tables) rows += Number((source.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n);
    const points = tables.includes('qc_points') ? Number((source.prepare('SELECT COUNT(*) AS n FROM qc_points').get() as { n: number }).n) : 0;
    return { ok: true, kind: 'sqlite', summary: { tables: tables.length, rows, points, schemaVersion, createdAt: info.get('createdAt') ?? '', bytes, legacy: false } };
  } catch {
    return { ok: false, code: 'corrupt', message: 'Không đọc được tệp backup — tệp có thể đã hỏng.' };
  } finally {
    source.close();
  }
}

function inspectJsonBackup(filePath: string, bytes: number): Inspected {
  if (bytes > LEGACY_JSON_MAX_BYTES) {
    return { ok: false, code: 'too-large', message: `Tệp backup JSON vượt ngưỡng ${Math.round(LEGACY_JSON_MAX_BYTES / 1024 / 1024)} MB.` };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return { ok: false, code: 'invalid-json', message: 'File không phải JSON hợp lệ.' };
  }
  const result = validateBackupEnvelope(raw, SCHEMA_VERSION);
  if (!result.ok) return result;
  const data = result.data.data;
  const rows = Object.values(data).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  const points = Array.isArray(data.qc_points) ? data.qc_points.length : 0;
  return {
    ok: true, kind: 'json', envelope: result.data,
    summary: { tables: Object.keys(data).length, rows, points, schemaVersion: result.data.schemaVersion, createdAt: result.data.createdAt, bytes, legacy: true },
  };
}

export function createBackupHandlers(db: Db, userDataDir: string) {
  function getMeta(key: string): string | null {
    const row = db.prepare('SELECT value FROM app_meta WHERE key=?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }
  function setMeta(key: string, value: string): void {
    db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  }

  /** CHỈ admin: bản backup là toàn bộ DB, gồm cả bảng `users` với chuỗi
   * PBKDF2 của mọi người dùng — vai trò chỉ-xem/KTV không được tải về.
   *
   * Ghi ra tệp tạm cạnh đích rồi mới đổi tên, để một lần xuất hỏng giữa chừng
   * không để lại tệp dở dang mang đúng tên người dùng đã chọn. */
  function exportBackupTo(filePath: string, actor: Actor): IpcResult<{ path: string; bytes: number; points: number }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const partial = `${filePath}.partial-${Date.now()}`;
    try {
      vacuumInto(db, partial);
      const copy = openExistingDatabase(partial, { readOnly: false });
      try {
        copy.exec('CREATE TABLE backup_info (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        const insert = copy.prepare('INSERT INTO backup_info(key,value) VALUES(?,?)');
        insert.run('format', BACKUP_FILE_FORMAT);
        insert.run('formatVersion', String(BACKUP_FILE_FORMAT_VERSION));
        insert.run('schemaVersion', String(SCHEMA_VERSION));
        insert.run('createdAt', nowIso());
      } finally {
        copy.close();
      }
      renameSync(partial, filePath);
    } catch (e) {
      try { if (existsSync(partial)) unlinkSync(partial); } catch { /* giữ lỗi gốc bên dưới */ }
      return fail('export-failed', `Không ghi được tệp backup: ${e instanceof Error ? e.message : String(e)}`);
    }
    const bytes = statSync(filePath).size;
    const points = Number((db.prepare('SELECT COUNT(*) AS n FROM qc_points').get() as { n: number }).n);
    // Mốc sao lưu gần nhất + kích thước để trang Cài đặt nhắc "Chưa sao lưu
    // trên máy này." / "Sao lưu gần nhất: N ngày trước."
    setMeta('lastBackupAt', nowIso());
    setMeta('lastBackupBytes', String(bytes));
    writeAudit(db, actor, 'Xuất backup', `Xuất backup ${(bytes / 1024 / 1024).toFixed(1)} MB, ${points} điểm QC`, '');
    return { ok: true, data: { path: filePath, bytes, points } };
  }

  /** Trạng thái sao lưu cho panel "Quản trị dữ liệu" — đọc, không ghi. */
  function backupStatus(): { lastBackupAt: string | null; lastBackupBytes: number } {
    return {
      lastBackupAt: getMeta('lastBackupAt'),
      lastBackupBytes: Number(getMeta('lastBackupBytes') || 0) || 0,
    };
  }

  /** "Kiểm tra backup" — CHỈ ĐỌC tệp người dùng chọn, KHÔNG chạm vào DB
   * đang dùng. Trả về số bảng/số dòng để người dùng biết tệp có đúng thứ mình
   * tưởng trước khi phục hồi. Không ghi audit: đây là kiểm tra một tệp, không
   * phải thao tác trên dữ liệu. */
  function verifyBackupFile(filePath: string, actor: Actor): IpcResult<BackupFileSummary> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const inspected = inspectBackupFile(filePath);
    if (!inspected.ok) return fail(inspected.code, inspected.message);
    return { ok: true, data: inspected.summary };
  }

  /** Phục hồi TOÀN BỘ dữ liệu từ tệp backup. Kiểm tra lại tệp ngay trước khi
   * ghi (tệp có thể đã đổi từ lúc người dùng xác nhận) và luôn chốt một bản
   * an toàn của dữ liệu hiện tại trước. */
  function importBackupFrom(filePath: string, actor: Actor): IpcResult<{ preRestoreSnapshotPath: string }> {
    if (actor.role !== 'admin') return fail('forbidden', 'Chỉ quản trị viên mới được phục hồi từ backup.');
    const inspected = inspectBackupFile(filePath);
    if (!inspected.ok) return fail(inspected.code, inspected.message);

    let snapshotPath: string;
    try {
      snapshotPath = writeSafetySnapshot(db, userDataDir, 'pre-restore-backup');
    } catch (e) {
      return fail('snapshot-failed', `Không tạo được bản sao lưu an toàn trước khi phục hồi, đã HUỶ: ${e instanceof Error ? e.message : String(e)}`);
    }

    try {
      if (inspected.kind === 'sqlite') restoreAllTablesFromFile(db, filePath);
      else restoreAllTables(db, inspected.envelope.data);
    } catch (e) {
      return fail('restore-failed', e instanceof Error ? e.message : 'Phục hồi thất bại.');
    }
    writeAudit(db, actor, 'Phục hồi từ backup', `Phục hồi ${inspected.summary.tables} bảng, ${inspected.summary.points} điểm QC, tạo trước 1 bản an toàn tại ${snapshotPath}`, '');
    // Phục hồi thay đổi GẦN NHƯ MỌI bảng cùng lúc — báo rộng hơn thường lệ
    // (writeAudit() chỉ tự báo 'activity') để mọi trang đang mở refetch lại
    // đúng, không cần khởi động lại app mới thấy dữ liệu đã phục hồi.
    notifyChanged(listTableNames(db));
    return { ok: true, data: { preRestoreSnapshotPath: snapshotPath } };
  }

  /** "Xóa sạch dữ liệu test" — xoá dữ liệu VẬN HÀNH, giữ lại tài khoản và
   * nhật ký hoạt động. Ánh xạ đúng `ResetOperationalDataCommand` hệ thống: mặc
   * định `keepUsers`/`keepAudit` đều bật, và `blankAppState()` của nó đưa
   * `lab` về giá trị mặc định — nên ở đây cũng reset bảng `lab` về default
   * của schema chứ không giữ tên đơn vị.
   *
   * GIỮ `activity` + `app_meta` (gồm `activityAnchor`) là điều kiện để chuỗi
   * hash tamper-evident không bị phá: xoá nhật ký mà giữ anchor, hoặc ngược
   * lại, sẽ làm `verifyAuditChain()` báo sai ngay dòng đầu. */
  function resetOperationalData(actor: Actor): IpcResult<{ preResetSnapshotPath: string; clearedTables: string[] }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    let snapshotPath: string;
    try {
      snapshotPath = writeSafetySnapshot(db, userDataDir, 'pre-reset-backup');
    } catch (e) {
      return fail('snapshot-failed', `Không tạo được bản sao lưu an toàn trước khi xoá, đã HUỶ: ${e instanceof Error ? e.message : String(e)}`);
    }
    const keep = new Set(['users', 'activity', 'app_meta', 'lab']);
    const cleared = listTableNames(db).filter((name) => !keep.has(name));
    try {
      db.exec('PRAGMA foreign_keys=OFF');
      db.exec('BEGIN');
      // Xoá theo thứ tự NGƯỢC danh sách bảng để bảng con đi trước bảng cha,
      // cùng lý do với restoreAllTables() trong db/table-io.ts.
      for (const table of [...cleared].reverse()) db.prepare(`DELETE FROM ${table}`).run();
      db.prepare("UPDATE lab SET name='', dept='', address='', brand_title='QC Lab', brand_sub='Nội kiểm xét nghiệm', logo_text='QC', logo_data='' WHERE id=1").run();
      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch { /* transaction đã tự đóng */ }
      return fail('reset-failed', e instanceof Error ? e.message : 'Xoá dữ liệu thất bại.');
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
    writeAudit(db, actor, 'Xoá sạch dữ liệu', `Xoá ${cleared.length} bảng dữ liệu vận hành (giữ tài khoản + nhật ký), bản an toàn tại ${snapshotPath}`, '');
    notifyChanged(listTableNames(db));
    return { ok: true, data: { preResetSnapshotPath: snapshotPath, clearedTables: cleared } };
  }

  return { exportBackupTo, backupStatus, verifyBackupFile, importBackupFrom, resetOperationalData };
}

export type BackupHandlers = ReturnType<typeof createBackupHandlers>;
