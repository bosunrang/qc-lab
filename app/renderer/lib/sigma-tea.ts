import type { TeaRef, Test } from '../../shared/qc-api';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE, type TeaCatalogItem } from '../../main/domain/tea-catalog';
import { labLevelTeas, resolveTea, type ResolvedTeaCore, type SigmaTeaSourceCore } from '../../main/domain/sigma-tea-core';

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



