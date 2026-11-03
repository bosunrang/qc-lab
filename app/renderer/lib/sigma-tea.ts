import type { TeaRef, Test } from '../../shared/qc-api';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE, type TeaCatalogItem } from '../../main/domain/tea-catalog';
import { hasLabTea, labLevelTeas, operationalTeaSummary, resolveTea, type ResolvedTeaCore, type SigmaTeaSourceCore } from '../../main/domain/sigma-tea-core';

export { teaCriterionText } from '../../main/domain/sigma-tea-core';

export type SigmaTeaSource = SigmaTeaSourceCore;
export type ResolvedSigmaTea = Omit<ResolvedTeaCore, 'catalog'> & { catalog: TeaCatalogItem | null };

/** Adapter trình bày: catalog tĩnh và lớp phủ TEa do phòng xét nghiệm quản
 * lý được đưa vào hàm thuần; renderer không chứa công thức quy đổi. */
export function resolveSigmaTea(test: Test, refs: TeaRef[], source: SigmaTeaSource, targetMean?: number | null, level?: number | null): ResolvedSigmaTea {
  return resolveTea(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE, source, targetMean, level);
}

/** TEa PXN khai riêng theo mức QC của đúng hồ sơ khớp xét nghiệm này. */
export function sigmaLabLevelTeas(test: Test, refs: TeaRef[]) {
  return labLevelTeas(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE);
}

/** Xét nghiệm đã có hồ sơ TEa của PXN — khi đó TEa PXN là nguồn mặc định. */
export function sigmaHasLabTea(test: Pick<Test, 'name' | 'tea_ref_key'>, refs: TeaRef[]) {
  return hasLabTea(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE);
}

/** TEa vận hành để hiển thị ở danh mục xét nghiệm — cùng thứ tự nguồn với
 * cổng Bias khi lập dải và ngoại kiểm (`resolveOperationalTea()`). */
export function operationalTeaText(test: Pick<Test, 'name' | 'tea_ref_key' | 'unit' | 'tea' | 'tea_source' | 'eflm_tea' | 'eflm_analyte' | 'eflm_ref' | 'eflm_lookup_date'>, refs: TeaRef[]) {
  return operationalTeaSummary(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE);
}



