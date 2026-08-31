// IPC handler cho trang So sanh hoa chat (reagent lot comparison). Renderer
// khong bao gio dung SQL truc tiep — chi goi cac ham dat ten ro rang o day.
import type { Db } from '../db/open-database';
import { cleanId, uid } from '../domain/text-utils';
import { prepareReagentMetadata, prepareReagentRows, type ReagentMetadataInput } from '../domain/reagent-validation';
import { calculateReagentComparison, RC_MIN_PAIRS, type ReagentComparisonResult } from '../domain/reagent-stats';
import { type Actor, type IpcResult, writeAudit } from './shared';

export interface ReagentComparisonRow {
  id: string; reagent: string; lot_old: string; lot_new: string; date: string; operator: string;
  sample_type: string; unit: string; bias_target: number | null; alpha: number | null;
  coverage_confirmed: 0 | 1; extra_json: string; rows_json: string;
}

export interface ReagentComparisonView extends ReagentComparisonRow {
  rows: [string, string][];
  result: ReagentComparisonResult;
}

function toView(row: ReagentComparisonRow): ReagentComparisonView {
  let rows: [string, string][];
  try { rows = JSON.parse(row.rows_json); } catch { rows = [['', '']]; }
  const result = calculateReagentComparison({
    rows,
    test: { biasTarget: row.bias_target ?? 6, alpha: row.alpha ?? 0.05, coverageConfirmed: !!row.coverage_confirmed },
  }, RC_MIN_PAIRS);
  return { ...row, rows, result };
}

export function createReagentHandlers(db: Db) {
  function blankRow(id: string, name = 'Hóa chất mới'): void {
    db.prepare(`INSERT INTO reagent_tests(id,reagent,lot_old,lot_new,date,operator,sample_type,unit,bias_target,alpha,coverage_confirmed,rows_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .run(id, name, '', '', '', '', 'Mẫu bệnh nhân', '', 6, 0.05, JSON.stringify(prepareReagentRows(null)));
  }

  function listComparisons(): ReagentComparisonView[] {
    const count = (db.prepare('SELECT COUNT(*) as c FROM reagent_tests').get() as { c: number }).c;
    if (count === 0) blankRow(cleanId(uid()));
    const rows = db.prepare('SELECT * FROM reagent_tests ORDER BY reagent').all() as unknown as ReagentComparisonRow[];
    return rows.map(toView);
  }

  function createComparison(input: { data: { name?: unknown; unit?: unknown } }, actor: Actor): IpcResult<ReagentComparisonView> {
    const id = cleanId(uid());
    const name = String(input.data?.name || '').trim() || 'Hóa chất mới';
    db.prepare(`INSERT INTO reagent_tests(id,reagent,lot_old,lot_new,date,operator,sample_type,unit,bias_target,alpha,coverage_confirmed,rows_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .run(id, name, '', '', '', '', 'Mẫu bệnh nhân', String(input.data?.unit || ''), 6, 0.05, JSON.stringify(prepareReagentRows(null)));
    writeAudit(db, actor, 'Tạo phép so sánh hóa chất', `Tạo "${name}"`, name);
    return { ok: true, data: toView(db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as unknown as ReagentComparisonRow) };
  }

  function saveMetadata(input: { id: unknown; data: ReagentMetadataInput }, actor: Actor): IpcResult<ReagentComparisonView> {
    const id = cleanId(input.id);
    const existing = db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as ReagentComparisonRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy phép so sánh.' } };
    const meta = prepareReagentMetadata(input.data, {
      reagent: existing.reagent, biasTarget: existing.bias_target ?? 6, alpha: existing.alpha ?? 0.05,
    });
    db.prepare(`UPDATE reagent_tests SET reagent=?,lot_old=?,lot_new=?,date=?,operator=?,sample_type=?,unit=?,bias_target=?,alpha=?,coverage_confirmed=? WHERE id=?`)
      .run(meta.reagent, meta.lotOld, meta.lotNew, meta.date, meta.operator, meta.sampleType, meta.unit, meta.biasTarget, meta.alpha, meta.coverageConfirmed ? 1 : 0, id);
    writeAudit(db, actor, 'Sửa thông tin so sánh hóa chất', `Cập nhật "${meta.reagent}"`, meta.reagent);
    return { ok: true, data: toView(db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as unknown as ReagentComparisonRow) };
  }

  function saveRows(input: { id: unknown; rows: unknown }, actor: Actor): IpcResult<ReagentComparisonView> {
    const id = cleanId(input.id);
    const existing = db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as ReagentComparisonRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy phép so sánh.' } };
    const rows = prepareReagentRows(input.rows);
    db.prepare('UPDATE reagent_tests SET rows_json=? WHERE id=?').run(JSON.stringify(rows), id);
    writeAudit(db, actor, 'Sửa dữ liệu so sánh hóa chất', `Cập nhật số liệu "${existing.reagent}"`, existing.reagent);
    return { ok: true, data: toView(db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as unknown as ReagentComparisonRow) };
  }

  function removeComparison(input: { id: unknown }, actor: Actor): IpcResult<{ id: string }> {
    const id = cleanId(input.id);
    const existing = db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as ReagentComparisonRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy phép so sánh.' } };
    const count = (db.prepare('SELECT COUNT(*) as c FROM reagent_tests').get() as { c: number }).c;
    if (count <= 1) return { ok: false, error: { code: 'last-comparison', message: 'Phải giữ lại ít nhất 1 phép so sánh.' } };
    db.prepare('DELETE FROM reagent_tests WHERE id=?').run(id);
    writeAudit(db, actor, 'Xóa phép so sánh hóa chất', `Xóa "${existing.reagent}"`, existing.reagent);
    return { ok: true, data: { id } };
  }

  return { listComparisons, createComparison, saveMetadata, saveRows, removeComparison };
}

export type ReagentHandlers = ReturnType<typeof createReagentHandlers>;
