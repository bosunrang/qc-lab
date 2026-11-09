// Xuất, kiểm tra và phục hồi dữ liệu của QC Lab.
//
// Tệp sao lưu là một tệp SQLite (xem `BACKUP_FILE_FORMAT`). Trước 2026-09-25
// backup là một chuỗi JSON dựng toàn bộ CSDL trong bộ nhớ và bị chặn ở 128 MB
// khi nhập lại — khoảng 175.000 điểm QC kèm nhật ký, tức vài năm dữ liệu của
// một phòng xét nghiệm. Tệp .json cũ vẫn phục hồi được (giữ ngưỡng 128 MB
// riêng cho đường này). Các hàm ở đây làm việc với ĐƯỜNG DẪN TỆP; hộp thoại
// chọn tệp do main process mở (index.ts), renderer không truyền nội dung tệp.
import { closeSync, existsSync, openSync, readFileSync, readSync, renameSync, statSync, unlinkSync } from 'node:fs';
import type { Db } from '../db/sqlite-like';
import { SCHEMA_VERSION, seedInitialRows } from '../db/schema';
import { openExistingDatabase } from '../db/open-database';
import { chainWarningNote, listTableNames, recordsLostByRestore, replaceAllTables, vacuumInto, withRestoreSource, writeSafetySnapshot, type RestoreSource } from '../db/table-io';
import { BACKUP_FILE_FORMAT, BACKUP_FILE_FORMAT_VERSION, validateBackupEnvelope, type BackupEnvelope } from '../domain/backup';
import { type Actor, type IpcResult, nowIso, requireAdmin } from './shared';
import { writeCommand, WriteCommandError } from './write-command';
import { quoteIdent } from '../db/sql-ident';
import { keepOperationMode, operationModeRestoreMessage, readOperationMode, type OperationModeState } from '../db/operation-mode';
import { MACHINE_LOCAL_META_KEYS } from '../domain/cloud-backup';

/** Ngưỡng chỉ còn áp cho tệp sao lưu JSON cũ: phải đọc cả tệp thành chuỗi. */
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

/** Kiểm tra một tệp sao lưu mà không chạm vào CSDL đang dùng. */
function inspectBackupFile(filePath: string): Inspected {
  if (!filePath || !existsSync(filePath)) return { ok: false, code: 'not-found', message: 'Không tìm thấy tệp sao lưu.' };
  const bytes = statSync(filePath).size;
  const header = readHeader(filePath);
  if (header === SQLITE_HEADER) return inspectSqliteBackup(filePath, bytes);
  if (header.trimStart().startsWith('{')) return inspectJsonBackup(filePath, bytes);
  return { ok: false, code: 'wrong-format', message: 'Tệp này không phải bản sao lưu của QC Lab.' };
}

function inspectSqliteBackup(filePath: string, bytes: number): Inspected {
  let source: ReturnType<typeof openExistingDatabase>;
  try {
    source = openExistingDatabase(filePath, { readOnly: true });
  } catch {
    return { ok: false, code: 'corrupt', message: 'Không mở được tệp sao lưu — tệp có thể đã hỏng.' };
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
      return { ok: false, code: 'corrupt', message: 'Tệp sao lưu không vượt qua kiểm tra toàn vẹn của SQLite — tệp có thể đã hỏng.' };
    }
    const info = new Map<string, string>();
    try {
      for (const row of source.prepare('SELECT key, value FROM backup_info').all() as { key: string; value: string }[]) info.set(row.key, row.value);
    } catch {
      return { ok: false, code: 'wrong-format', message: 'Tệp SQLite này không phải bản sao lưu của QC Lab (thiếu phần mô tả bản sao lưu).' };
    }
    if (info.get('format') !== BACKUP_FILE_FORMAT) {
      return { ok: false, code: 'wrong-format', message: `Tệp này không đúng định dạng sao lưu được hỗ trợ (format="${info.get('format') ?? ''}").` };
    }
    const schemaVersion = Number(info.get('schemaVersion'));
    if (!Number.isInteger(schemaVersion) || schemaVersion > SCHEMA_VERSION) {
      return { ok: false, code: 'unsupported-schema', message: 'Bản sao lưu được tạo từ phiên bản mới hơn phần mềm hiện tại, không thể phục hồi.' };
    }
    const tables = (source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name<>'backup_info'").all() as { name: string }[]).map((r) => r.name);
    let rows = 0;
    for (const table of tables) rows += Number((source.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdent(table)}`).get() as { n: number }).n);
    const points = tables.includes('qc_points') ? Number((source.prepare('SELECT COUNT(*) AS n FROM qc_points').get() as { n: number }).n) : 0;
    return { ok: true, kind: 'sqlite', summary: { tables: tables.length, rows, points, schemaVersion, createdAt: info.get('createdAt') ?? '', bytes, legacy: false } };
  } catch {
    return { ok: false, code: 'corrupt', message: 'Không đọc được tệp sao lưu — tệp có thể đã hỏng.' };
  } finally {
    source.close();
  }
}

function inspectJsonBackup(filePath: string, bytes: number): Inspected {
  if (bytes > LEGACY_JSON_MAX_BYTES) {
    return { ok: false, code: 'too-large', message: `Tệp sao lưu JSON vượt ngưỡng ${Math.round(LEGACY_JSON_MAX_BYTES / 1024 / 1024)} MB.` };
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
  // VACUUM INTO không chạy được trong transaction: tệp được chép TRƯỚC,
  // `w.commit()` chỉ ghi mốc sao lưu và nhật ký.
  const exportBackupTo = writeCommand(db, 'exportBackupTo', 'admin', (w, filePath: string): IpcResult<{ path: string; bytes: number; points: number }> => {
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
      return fail('export-failed', `Không ghi được tệp sao lưu: ${e instanceof Error ? e.message : String(e)}`);
    }
    const bytes = statSync(filePath).size;
    const points = Number((db.prepare('SELECT COUNT(*) AS n FROM qc_points').get() as { n: number }).n);
    // Mốc sao lưu gần nhất + kích thước để trang Cài đặt nhắc "Chưa sao lưu
    // trên máy này." / "Sao lưu gần nhất: N ngày trước."
    w.commit((tx) => {
      setMeta('lastBackupAt', nowIso());
      setMeta('lastBackupBytes', String(bytes));
      tx.audit('Xuất bản sao lưu', `Xuất bản sao lưu ${(bytes / 1024 / 1024).toFixed(1)} MB, ${points} điểm QC`, '');
      // Trước đây thiếu: trang Cài đặt đang mở không biết mốc sao lưu đã đổi.
      tx.changed(['app_meta']);
    });
    return { ok: true, data: { path: filePath, bytes, points } };
  });

  /** Trạng thái cho panel "Quản trị dữ liệu" — đọc, không ghi. `activityRows`
   * để nhắc lưu trữ nhật ký khi bảng lớn (app không tự xoá nhật ký). */
  function backupStatus(): { lastBackupAt: string | null; lastBackupBytes: number; activityRows: number; operationMode: OperationModeState | null } {
    return {
      lastBackupAt: getMeta('lastBackupAt'),
      lastBackupBytes: Number(getMeta('lastBackupBytes') || 0) || 0,
      activityRows: Number((db.prepare('SELECT COUNT(*) AS n FROM activity').get() as { n: number }).n),
      operationMode: readOperationMode(db),
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

  /** Phục hồi TOÀN BỘ dữ liệu từ tệp sao lưu. Kiểm tra lại tệp ngay trước khi
   * ghi (tệp có thể đã đổi từ lúc người dùng xác nhận) và luôn chốt một bản
   * an toàn của dữ liệu hiện tại trước. */
  const importBackupFrom = writeCommand(db, 'importBackupFrom', (actor) => (actor.role === 'admin' ? null : { ok: false as const, error: { code: 'forbidden', message: 'Chỉ quản trị viên mới được phục hồi từ bản sao lưu.' } }), (w, filePath: string, options: { keepAccounts?: boolean } | undefined): IpcResult<{ preRestoreSnapshotPath: string }> => {
    const inspected = inspectBackupFile(filePath);
    // Giữ tài khoản: chỉ thay dữ liệu, bảng `users` của máy này giữ nguyên để
    // người đang dùng vẫn đăng nhập bằng mật khẩu hiện tại (như đồng bộ Firebase).
    const keep = options?.keepAccounts ? ['users'] : [];
    if (!inspected.ok) return fail(inspected.code, inspected.message);
    const source: RestoreSource = inspected.kind === 'sqlite' ? { kind: 'sqlite', filePath } : { kind: 'json', data: inspected.envelope.data };

    // Chế độ vận hành: phục hồi không được xoá cứng hồ sơ (quy tắc "không
    // xoá cứng điểm QC", ISO 15189:2022 8.4). Bản sao lưu thiếu điểm QC hay hồ
    // sơ đang có (NCE, kỳ khoá, biên bản tháng, EQA…), hoặc mang bản cũ hơn,
    // thì chặn trước khi chạm vào dữ liệu.
    if (readOperationMode(db)) {
      const losses = withRestoreSource(db, source, () => recordsLostByRestore(db, source));
      if (losses.length) return fail('operation-mode', operationModeRestoreMessage(losses));
    }

    let snapshotPath: string;
    try {
      snapshotPath = writeSafetySnapshot(db, userDataDir, 'pre-restore-backup');
    } catch (e) {
      return fail('snapshot-failed', `Không tạo được bản sao lưu an toàn trước khi phục hồi, đã HUỶ: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Thay dữ liệu, ghi lại cờ chế độ vận hành và dòng nhật ký là MỘT đơn vị:
    // dừng giữa chừng thì không còn trạng thái "đã phục hồi mà mất cờ" hay
    // "đã phục hồi mà không có nhật ký". Khoá ngoại và ATTACH phải chuẩn bị
    // ngoài transaction nên `withRestoreSource` bọc ngoài `w.commit()`. Phục
    // hồi đổi GẦN NHƯ MỌI bảng — báo rộng để mọi trang đang mở nạp lại.
    try {
      withRestoreSource(db, source, () => w.commit((tx) => {
        const outcome = keepOperationMode(db, () => replaceAllTables(db, source, { keep, keepMetaKeys: MACHINE_LOCAL_META_KEYS }));
        const keptNote = outcome.keptActivity ? `, giữ ${outcome.keptActivity} dòng nhật ký phát sinh sau bản sao lưu` : '';
        tx.audit('Phục hồi từ bản sao lưu', `Phục hồi ${inspected.summary.tables} bảng, ${inspected.summary.points} điểm QC${keep.length ? ', giữ tài khoản hiện tại' : ', thay cả tài khoản'}${keptNote}, tạo trước 1 bản an toàn tại ${snapshotPath}${chainWarningNote(outcome)}`, '');
        tx.changed(listTableNames(db));
      }));
    } catch (e) {
      if (e instanceof WriteCommandError) throw e;
      return fail('restore-failed', e instanceof Error ? e.message : 'Phục hồi thất bại.');
    }
    return { ok: true, data: { preRestoreSnapshotPath: snapshotPath } };
  });

  /** "Xoá sạch dữ liệu thử" — xoá dữ liệu VẬN HÀNH, giữ lại tài khoản và
   * nhật ký hoạt động. Bảng `lab` cũng được reset về default của schema chứ
   * không giữ tên đơn vị.
   *
   * GIỮ `activity` + `app_meta` (gồm `activityAnchor`) là điều kiện để chuỗi
   * hash tamper-evident không bị phá: xoá nhật ký mà giữ anchor, hoặc ngược
   * lại, sẽ làm `verifyAuditChain()` báo sai ngay dòng đầu. */
  const resetOperationalData = writeCommand(db, 'resetOperationalData', 'admin', (w): IpcResult<{ preResetSnapshotPath: string; clearedTables: string[] }> => {
    if (readOperationMode(db)) {
      return fail('operation-mode', 'Hệ thống đang ở chế độ vận hành nên không xoá sạch dữ liệu được. Dữ liệu QC chỉ thay đổi qua các quy trình có nhật ký.');
    }
    let snapshotPath: string;
    try {
      snapshotPath = writeSafetySnapshot(db, userDataDir, 'pre-reset-backup');
    } catch (e) {
      return fail('snapshot-failed', `Không tạo được bản sao lưu an toàn trước khi xoá, đã HUỶ: ${e instanceof Error ? e.message : String(e)}`);
    }
    const keep = new Set(['users', 'activity', 'app_meta', 'lab']);
    const cleared = listTableNames(db).filter((name) => !keep.has(name));
    try {
      // PRAGMA foreign_keys không đổi được trong transaction nên bật/tắt ở ngoài.
      db.exec('PRAGMA foreign_keys=OFF');
      w.commit((tx) => {
        // Xoá theo thứ tự NGƯỢC danh sách bảng để bảng con đi trước bảng cha,
        // cùng lý do với restoreAllTables() trong db/table-io.ts.
        for (const table of [...cleared].reverse()) db.prepare(`DELETE FROM ${quoteIdent(table)}`).run();
        db.prepare("UPDATE lab SET name='', dept='', address='', brand_title='QC Lab', brand_sub='Nội kiểm xét nghiệm', logo_text='QC', logo_data='' WHERE id=1").run();
        seedInitialRows(db);
        // Nhật ký nay nằm CÙNG transaction với phần xoá (trước đây ghi sau).
        tx.audit('Xoá sạch dữ liệu', `Xoá ${cleared.length} bảng dữ liệu vận hành (giữ tài khoản + nhật ký), bản an toàn tại ${snapshotPath}`, '');
        tx.changed(listTableNames(db));
      });
    } catch (e) {
      return fail('reset-failed', e instanceof Error ? e.message : 'Xoá dữ liệu thất bại.');
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
    return { ok: true, data: { preResetSnapshotPath: snapshotPath, clearedTables: cleared } };
  });

  return { exportBackupTo, backupStatus, verifyBackupFile, importBackupFrom, resetOperationalData };
}

export type BackupHandlers = ReturnType<typeof createBackupHandlers>;
