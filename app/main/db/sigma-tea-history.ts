import type { Db } from './sqlite-like';
import { loadTeaRefs, loadTeaTest } from './operational-tea';
import { operationalTeaSource, resolveTea, type SigmaTeaSourceCore } from '../domain/sigma-tea-core';
import { resolvePeriodTea } from '../domain/sigma-period-tea';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE } from '../domain/tea-catalog';
import { finiteNumber } from '../domain/text-utils';

/** Giữ TEa đang hiển thị của kỳ cũ trước khi đổi cấu hình vận hành. Hàm chỉ
 * được gọi trong transaction của thao tác cấu hình, cùng audit và notify.
 * Kỳ có snapshot số được giữ nguyên; kỳ chưa chụp chỉ giữ giá trị đã giải
 * được. Không đóng băng null để nguồn hợp lệ sau đó vẫn tính được Sigma. */
export function preserveSigmaTeaHistory(db: Db, testId: string): number {
  const test = loadTeaTest(db, testId);
  if (!test) return 0;
  const refs = loadTeaRefs(db);
  const currentSource = operationalTeaSource(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE);
  const means = new Map((db.prepare('SELECT level,mean FROM test_levels WHERE test_id=?').all(testId) as { level: number; mean: number | null }[]).map(row => [row.level, row.mean]));
  const rows = db.prepare('SELECT id,tea,tea_source,lv_json FROM sigma_data WHERE test_id=?').all(testId) as { id: string; tea: number | null; tea_source: string; lv_json: string }[];
  let changed = 0;
  for (const row of rows) {
    let needsWrite = false;
    const levels = JSON.parse(row.lv_json || '[]') as { level: number; tea?: unknown; targetMean?: unknown; teaLocked?: boolean; teaBasis?: unknown }[];
    for (const level of levels) {
      const snapshot = finiteNumber(level.tea, NaN);
      if (Number.isFinite(snapshot) && snapshot > 0) continue;
      const target = finiteNumber(level.targetMean, NaN);
      const mean = Number.isFinite(target) && target !== 0 ? target : means.get(level.level) ?? null;
      let capturedBasis: { value: number; criterion: string; criterionDetail: ReturnType<typeof resolveTea>['criterionDetail']; source: string; reference: string; capturedAt: string; targetMean: number | null } | undefined;
      const bySource = (source: string): number | null => {
        if (!['lab', 'clia', 'ricos', 'eflm'].includes(source)) return null;
        const { value, criterion, criterionDetail } = resolveTea(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE, source as SigmaTeaSourceCore, mean, level.level);
        if (value == null || value <= 0) return null;
        capturedBasis = { value, criterion, criterionDetail, source,
          reference: source === 'eflm' ? [test.eflm_analyte, test.eflm_ref, test.eflm_lookup_date].filter(Boolean).join(' · ') : '',
          capturedAt: new Date().toISOString(), targetMean: mean };
        return value;
      };
      const resolved = resolvePeriodTea({ tea: null }, row.tea,
        () => bySource(row.tea_source.toLowerCase()),
        () => currentSource && currentSource !== row.tea_source ? bySource(currentSource) : null);
      if (resolved == null) continue;
      level.tea = resolved;
      level.teaLocked = true;
      // Ghi đúng nguồn thực sự đã giải giá trị (kể cả nguồn dự phòng),
      // không gán nhãn nguồn kỳ cho một con số lấy từ nguồn khác.
      if (!level.teaBasis && capturedBasis) level.teaBasis = capturedBasis;
      needsWrite = true;
    }
    if (needsWrite) {
      db.prepare('UPDATE sigma_data SET lv_json=? WHERE id=?').run(JSON.stringify(levels), row.id);
      changed += 1;
    }
  }
  return changed;
}
