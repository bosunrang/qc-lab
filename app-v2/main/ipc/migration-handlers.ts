// Giai đoạn C4 (docs/APP-V2-PLAN.md) — di trú dữ liệu từ backup app CŨ sang
// app-v2. `preview()` chỉ ánh xạ + đếm (KHÔNG ghi DB) để renderer hiện rõ
// "sẽ nhập bao nhiêu máy/xét nghiệm/điểm QC..." trước khi người dùng xác
// nhận — thao tác THAY THẾ TOÀN BỘ dữ liệu hiện có, cùng mức độ nặng với
// phục hồi backup (C3) nên dùng lại ĐÚNG transaction xoá-rồi-nạp
// (`restoreAllTables`) và ĐÚNG cơ chế an toàn (chốt 1 bản backup trước khi
// ghi đè) từ `table-io.ts`.
import type { Db } from '../db/sqlite-like';
import { writeSafetySnapshot, restoreAllTables } from '../db/table-io';
import { mapLegacyStateToTables, parseLegacyBackupEnvelope, summarizeMappedTables, type MigrationSummary } from '../domain/migrate-legacy';
import { type Actor, type IpcResult, writeAudit, notifyChanged } from './shared';

export function createMigrationHandlers(db: Db, userDataDir: string) {
  function preview(input: { data: { json: string } }): IpcResult<MigrationSummary> {
    let raw: unknown;
    try {
      raw = JSON.parse(input.data.json);
    } catch {
      return { ok: false, error: { code: 'invalid-json', message: 'File không phải JSON hợp lệ.' } };
    }
    const parsed = parseLegacyBackupEnvelope(raw);
    if (!parsed.ok) return { ok: false, error: { code: parsed.code, message: parsed.message } };
    const mapped = mapLegacyStateToTables(parsed.data.data);
    return { ok: true, data: summarizeMappedTables(mapped) };
  }

  function importLegacy(input: { data: { json: string } }, actor: Actor): IpcResult<{ preMigrationSnapshotPath: string; summary: MigrationSummary }> {
    if (actor.role !== 'admin') return { ok: false, error: { code: 'forbidden', message: 'Chỉ quản trị viên mới được di trú dữ liệu từ app cũ.' } };
    let raw: unknown;
    try {
      raw = JSON.parse(input.data.json);
    } catch {
      return { ok: false, error: { code: 'invalid-json', message: 'File không phải JSON hợp lệ.' } };
    }
    const parsed = parseLegacyBackupEnvelope(raw);
    if (!parsed.ok) return { ok: false, error: { code: parsed.code, message: parsed.message } };
    const mapped = mapLegacyStateToTables(parsed.data.data);
    const summary = summarizeMappedTables(mapped);

    let snapshotPath: string;
    try {
      snapshotPath = writeSafetySnapshot(db, userDataDir, 'pre-migration-backup');
    } catch (e) {
      return { ok: false, error: { code: 'snapshot-failed', message: `Không tạo được bản sao lưu an toàn trước khi di trú, đã HUỶ: ${e instanceof Error ? e.message : String(e)}` } };
    }

    try {
      restoreAllTables(db, mapped as unknown as Record<string, Record<string, unknown>[]>);
    } catch (e) {
      return { ok: false, error: { code: 'migration-failed', message: e instanceof Error ? e.message : 'Di trú thất bại.' } };
    }
    writeAudit(db, actor, 'Di trú dữ liệu từ app cũ', `Đã nhập ${summary.tests} xét nghiệm, ${summary.qcPoints} điểm QC, ${summary.users} người dùng — tạo trước 1 bản an toàn tại ${snapshotPath}`, '');
    notifyChanged(['lab', 'instruments', 'lot_groups', 'qc_lots', 'qc_panels', 'lot_transitions', 'tests', 'test_levels', 'qc_points', 'sigma_data', 'users', 'actions', 'reagent_tests', 'period_locks', 'tea_refs']);
    return { ok: true, data: { preMigrationSnapshotPath: snapshotPath, summary } };
  }

  return { preview, importLegacy };
}

export type MigrationHandlers = ReturnType<typeof createMigrationHandlers>;
