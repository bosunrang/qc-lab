// Xuất, kiểm tra và phục hồi dữ liệu của QC Lab.
import type { Db } from '../db/sqlite-like';
import { SCHEMA_VERSION } from '../db/schema';
import { listTableNames, dumpAllTables, restoreAllTables, writeSafetySnapshot } from '../db/table-io';
import { buildBackupEnvelope, validateBackupEnvelope } from '../domain/backup';
import { type Actor, type IpcResult, nowIso, writeAudit, notifyChanged, requireAdmin } from './shared';


const MAX_IMPORT_BYTES = 128 * 1024 * 1024;

export function createBackupHandlers(db: Db, userDataDir: string) {
  function getMeta(key: string): string | null {
    const row = db.prepare('SELECT value FROM app_meta WHERE key=?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }
  function setMeta(key: string, value: string): void {
    db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  }

  /** CHỈ admin: bản backup là toàn bộ DB, gồm cả bảng `users` với chuỗi
   * PBKDF2 của mọi người dùng — vai trò chỉ-xem/KTV không được tải về. Ở app
   * cũ, `exportData()` cũng `requireAdmin()` (settings-page-controller.ts).
   * `importBackup` bên dưới tự kiểm admin từ Giai đoạn C3, XUẤT thì chưa. */
  function exportBackup(actor: Actor): IpcResult<string> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const data = dumpAllTables(db);
    const envelope = buildBackupEnvelope(data, SCHEMA_VERSION, 'app', nowIso());
    const json = JSON.stringify(envelope);
    // Ghi mốc sao lưu gần nhất + kích thước để trang Cài đặt nhắc đúng như
    // hệ thống ("Chưa sao lưu trên máy này." / "Sao lưu gần nhất: N ngày
    // trước." + cỡ file so với ngưỡng khuyến nghị). hệ thống giữ mốc này
    // trong `state`; app dùng `app_meta` — cùng cơ chế key/value đã dùng
    // cho `activityAnchor` (Giai đoạn B8), không thêm bảng mới.
    setMeta('lastBackupAt', nowIso());
    setMeta('lastBackupBytes', String(json.length));
    writeAudit(db, actor, 'Xuất backup', `Xuất ${Object.keys(data).length} bảng`, '');
    return { ok: true, data: json };
  }

  /** Trạng thái sao lưu cho panel "Quản trị dữ liệu" — đọc, không ghi. */
  function backupStatus(): { lastBackupAt: string | null; lastBackupBytes: number; maxImportBytes: number } {
    return {
      lastBackupAt: getMeta('lastBackupAt'),
      lastBackupBytes: Number(getMeta('lastBackupBytes') || 0) || 0,
      maxImportBytes: MAX_IMPORT_BYTES,
    };
  }

  function importBackup(input: { data: { json: string } }, actor: Actor): IpcResult<{ preRestoreSnapshotPath: string }> {
    if (input.data.json.length > MAX_IMPORT_BYTES) {
      return { ok: false, error: { code: 'too-large', message: `File backup vượt ngưỡng ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)} MB.` } };
    }
    if (actor.role !== 'admin') return { ok: false, error: { code: 'forbidden', message: 'Chỉ quản trị viên mới được phục hồi từ backup.' } };
    let raw: unknown;
    try {
      raw = JSON.parse(input.data.json);
    } catch {
      return { ok: false, error: { code: 'invalid-json', message: 'File không phải JSON hợp lệ.' } };
    }
    const result = validateBackupEnvelope(raw, SCHEMA_VERSION);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };

    let snapshotPath: string;
    try {
      snapshotPath = writeSafetySnapshot(db, userDataDir, 'pre-restore-backup');
    } catch (e) {
      return { ok: false, error: { code: 'snapshot-failed', message: `Không tạo được bản sao lưu an toàn trước khi phục hồi, đã HUỶ: ${e instanceof Error ? e.message : String(e)}` } };
    }

    try {
      restoreAllTables(db, result.data.data);
    } catch (e) {
      return { ok: false, error: { code: 'restore-failed', message: e instanceof Error ? e.message : 'Phục hồi thất bại.' } };
    }
    writeAudit(db, actor, 'Phục hồi từ backup', `Phục hồi ${Object.keys(result.data.data).length} bảng, tạo trước 1 bản an toàn tại ${snapshotPath}`, '');
    // Phục hồi thay đổi GẦN NHƯ MỌI bảng cùng lúc — báo rộng hơn thường lệ
    // (writeAudit() chỉ tự báo 'activity') để mọi trang đang mở refetch lại
    // đúng, không cần khởi động lại app mới thấy dữ liệu đã phục hồi.
    notifyChanged(listTableNames(db));
    return { ok: true, data: { preRestoreSnapshotPath: snapshotPath } };
  }

  /** "Kiểm tra backup" — CHỈ ĐỌC file người dùng chọn, KHÔNG chạm vào DB
   * đang dùng (hệ thống: `verifyBackupFile()`). Trả về số bảng/số dòng để
   * người dùng biết file có đúng thứ mình tưởng trước khi phục hồi. Không
   * ghi audit: đây là kiểm tra một file, không phải thao tác trên dữ liệu. */
  function verifyBackup(input: { data: { json: string } }, actor: Actor): IpcResult<{ tables: number; rows: number; points: number; schemaVersion: number; createdAt: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    let raw: unknown;
    try {
      raw = JSON.parse(input.data.json);
    } catch {
      return { ok: false, error: { code: 'invalid-json', message: 'File không phải JSON hợp lệ.' } };
    }
    const result = validateBackupEnvelope(raw, SCHEMA_VERSION);
    if (!result.ok) return { ok: false, error: { code: result.code, message: result.message } };
    const data = result.data.data;
    const rows = Object.values(data).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
    const points = Array.isArray(data.qc_points) ? data.qc_points.length : 0;
    return { ok: true, data: { tables: Object.keys(data).length, rows, points, schemaVersion: result.data.schemaVersion, createdAt: result.data.createdAt } };
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
      return { ok: false, error: { code: 'snapshot-failed', message: `Không tạo được bản sao lưu an toàn trước khi xoá, đã HUỶ: ${e instanceof Error ? e.message : String(e)}` } };
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
      return { ok: false, error: { code: 'reset-failed', message: e instanceof Error ? e.message : 'Xoá dữ liệu thất bại.' } };
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
    writeAudit(db, actor, 'Xoá sạch dữ liệu', `Xoá ${cleared.length} bảng dữ liệu vận hành (giữ tài khoản + nhật ký), bản an toàn tại ${snapshotPath}`, '');
    notifyChanged(listTableNames(db));
    return { ok: true, data: { preResetSnapshotPath: snapshotPath, clearedTables: cleared } };
  }

  return { exportBackup, backupStatus, importBackup, verifyBackup, resetOperationalData };
}

export type BackupHandlers = ReturnType<typeof createBackupHandlers>;


