import type { Db } from '../db/sqlite-like';
import { cleanId, cleanText, uid } from '../domain/text-utils';
import {
  validateReagentMetadata, prepareReagentRows, cleanQuickValueType, addQuickValue, DEFAULT_SAMPLE_TYPES,
  type ReagentMetadataInput, type QuickValueType,
} from '../domain/reagent-validation';
import { calculateReagentComparison, RC_MIN_PAIRS, type ReagentComparisonResult } from '../domain/reagent-stats';
import { type Actor, type IpcResult, writeAudit, notifyChanged, requireWrite, requireAdmin } from './shared';

export interface ReagentComparisonRow {
  id: string; reagent: string; lot_old: string; lot_new: string; date: string; operator: string;
  sample_type: string; unit: string; bias_target: number | null; alpha: number | null;
  coverage_confirmed: 0 | 1; extra_json: string; rows_json: string;
}

export interface ReagentComparisonView extends ReagentComparisonRow {
  rows: [string, string][];
  result: ReagentComparisonResult;
}

function objectInput(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toView(row: ReagentComparisonRow): ReagentComparisonView {
  let rawRows: unknown = null;
  try { rawRows = JSON.parse(row.rows_json); } catch { /* chuẩn hoá thành dòng trống phía dưới */ }
  // SQLite có thể chứa dữ liệu cũ/khôi phục không đúng cấu trúc. Luôn đi qua
  // cùng chuẩn hoá với saveRows để một bản ghi lỗi không làm hỏng cả trang.
  const rows = prepareReagentRows(rawRows);
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

  function createComparison(input: unknown, actor: Actor): IpcResult<ReagentComparisonView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const id = cleanId(uid());
    const data = objectInput(objectInput(input).data);
    const name = cleanText(data.name, 120).trim() || 'Hóa chất mới';
    const unit = cleanText(data.unit, 40).trim();
    db.prepare(`INSERT INTO reagent_tests(id,reagent,lot_old,lot_new,date,operator,sample_type,unit,bias_target,alpha,coverage_confirmed,rows_json)
      VALUES (?,?,?,?,?,?,?,?,?,?,0,?)`)
      .run(id, name, '', '', '', '', 'Mẫu bệnh nhân', unit, 6, 0.05, JSON.stringify(prepareReagentRows(null)));
    writeAudit(db, actor, 'Tạo phép so sánh hóa chất', `Tạo "${name}"`, name);
    notifyChanged(['reagent_tests']);
    return { ok: true, data: toView(db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as unknown as ReagentComparisonRow) };
  }

  function saveMetadata(input: unknown, actor: Actor): IpcResult<ReagentComparisonView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const payload = objectInput(input);
    const id = cleanId(payload.id);
    const existing = db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as ReagentComparisonRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy phép so sánh.' } };
    const validation = validateReagentMetadata(objectInput(payload.data) as ReagentMetadataInput, {
      reagent: existing.reagent, lotOld: existing.lot_old, lotNew: existing.lot_new, date: existing.date,
      operator: existing.operator, sampleType: existing.sample_type, unit: existing.unit,
      biasTarget: existing.bias_target ?? 6, alpha: existing.alpha ?? 0.05,
      coverageConfirmed: !!existing.coverage_confirmed,
    });
    if (!validation.ok) return validation;
    const meta = validation.data;
    const unchanged = meta.reagent === existing.reagent && meta.lotOld === existing.lot_old && meta.lotNew === existing.lot_new
      && meta.date === existing.date && meta.operator === existing.operator && meta.sampleType === existing.sample_type
      && meta.unit === existing.unit && meta.biasTarget === (existing.bias_target ?? 6) && meta.alpha === (existing.alpha ?? 0.05)
      && meta.coverageConfirmed === !!existing.coverage_confirmed;
    if (unchanged) return { ok: true, data: toView(existing) };
    db.prepare(`UPDATE reagent_tests SET reagent=?,lot_old=?,lot_new=?,date=?,operator=?,sample_type=?,unit=?,bias_target=?,alpha=?,coverage_confirmed=? WHERE id=?`)
      .run(meta.reagent, meta.lotOld, meta.lotNew, meta.date, meta.operator, meta.sampleType, meta.unit, meta.biasTarget, meta.alpha, meta.coverageConfirmed ? 1 : 0, id);
    writeAudit(db, actor, 'Sửa thông tin so sánh hóa chất', `Cập nhật "${meta.reagent}"`, meta.reagent);
    notifyChanged(['reagent_tests']);
    return { ok: true, data: toView(db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as unknown as ReagentComparisonRow) };
  }

  function saveRows(input: unknown, actor: Actor): IpcResult<ReagentComparisonView> {
    const denied = requireWrite(actor); if (denied) return denied;
    const payload = objectInput(input);
    const id = cleanId(payload.id);
    const existing = db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as ReagentComparisonRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy phép so sánh.' } };
    const rows = prepareReagentRows(payload.rows);
    const rowsJson = JSON.stringify(rows);
    if (rowsJson === existing.rows_json) return { ok: true, data: toView(existing) };
    db.prepare('UPDATE reagent_tests SET rows_json=? WHERE id=?').run(rowsJson, id);
    writeAudit(db, actor, 'Sửa dữ liệu so sánh hóa chất', `Cập nhật số liệu "${existing.reagent}"`, existing.reagent);
    notifyChanged(['reagent_tests']);
    return { ok: true, data: toView(db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as unknown as ReagentComparisonRow) };
  }

  function removeComparison(input: unknown, actor: Actor): IpcResult<{ id: string }> {
    const denied = requireAdmin(actor); if (denied) return denied;
    const id = cleanId(objectInput(input).id);
    const existing = db.prepare('SELECT * FROM reagent_tests WHERE id=?').get(id) as ReagentComparisonRow | undefined;
    if (!existing) return { ok: false, error: { code: 'not-found', message: 'Không tìm thấy phép so sánh.' } };
    const count = (db.prepare('SELECT COUNT(*) as c FROM reagent_tests').get() as { c: number }).c;
    if (count <= 1) return { ok: false, error: { code: 'last-comparison', message: 'Phải giữ lại ít nhất 1 phép so sánh.' } };
    db.prepare('DELETE FROM reagent_tests WHERE id=?').run(id);
    writeAudit(db, actor, 'Xóa phép so sánh hóa chất', `Xóa "${existing.reagent}"`, existing.reagent);
    notifyChanged(['reagent_tests']);
    return { ok: true, data: { id } };
  }

  /** "Chọn nhanh" người thực hiện/loại mẫu — 1 danh sách CHUNG cho toàn app
   * (không gắn theo phép so sánh), lưu ở `app_meta` cùng cơ chế key/value đã
   * dùng cho `activityAnchor`/cấu hình LIS (schema không có bảng riêng cho
   * việc này, và bản thân đây chỉ là gợi ý nhập liệu, không phải dữ liệu QC).
   * Loại mẫu luôn có sẵn 3 giá trị mặc định (`prepareReagentMetadata()` cũng
   * fallback về đúng giá trị đầu — "Mẫu bệnh nhân" — khi bỏ trống). */
  function metaKey(type: QuickValueType): string { return `reagent_quick_${type}`; }
  function readQuickList(type: QuickValueType): string[] {
    const row = db.prepare('SELECT value FROM app_meta WHERE key=?').get(metaKey(type)) as { value: string } | undefined;
    if (!row) return type === 'sampleType' ? [...DEFAULT_SAMPLE_TYPES] : [];
    try { const parsed = JSON.parse(row.value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
  }
  function writeQuickList(type: QuickValueType, items: readonly string[]): void {
    db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(metaKey(type), JSON.stringify(items));
  }

  function listQuickValues(input: unknown): IpcResult<string[]> {
    const type = cleanQuickValueType(objectInput(input).type);
    if (!type) return { ok: false, error: { code: 'invalid-type', message: 'Loại giá trị chọn nhanh không hợp lệ.' } };
    return { ok: true, data: readQuickList(type) };
  }

  function addQuickListValue(input: unknown, actor: Actor): IpcResult<{ items: string[]; value: string }> {
    const denied = requireWrite(actor); if (denied) return denied;
    const payload = objectInput(input);
    const type = cleanQuickValueType(payload.type);
    if (!type) return { ok: false, error: { code: 'invalid-type', message: 'Loại giá trị chọn nhanh không hợp lệ.' } };
    const result = addQuickValue(readQuickList(type), payload.value);
    if ('error' in result) return { ok: false, error: { code: result.error, message: 'Nhập giá trị cần thêm.' } };
    if (result.added) { writeQuickList(type, result.items); notifyChanged(['app_meta']); }
    return { ok: true, data: { items: result.items, value: result.value } };
  }

  function removeQuickListValue(input: unknown, actor: Actor): IpcResult<{ items: string[] }> {
    const denied = requireWrite(actor); if (denied) return denied;
    const payload = objectInput(input);
    const type = cleanQuickValueType(payload.type);
    if (!type) return { ok: false, error: { code: 'invalid-type', message: 'Loại giá trị chọn nhanh không hợp lệ.' } };
    const items = readQuickList(type);
    const index = Number(payload.index);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return { ok: false, error: { code: 'invalid-index', message: 'Không tìm thấy giá trị cần xoá.' } };
    items.splice(index, 1);
    writeQuickList(type, items);
    notifyChanged(['app_meta']);
    return { ok: true, data: { items } };
  }

  return { listComparisons, createComparison, saveMetadata, saveRows, removeComparison, listQuickValues, addQuickListValue, removeQuickListValue };
}

export type ReagentHandlers = ReturnType<typeof createReagentHandlers>;


