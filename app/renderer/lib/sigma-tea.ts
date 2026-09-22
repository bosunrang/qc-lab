import type { TeaRef, Test } from '../../shared/qc-api';
import { TEA_CATALOG_WITH_CLIA_ABSOLUTE, type TeaCatalogItem } from '../../main/domain/tea-catalog';
import { resolveTea, type ResolvedTeaCore, type SigmaTeaSourceCore } from '../../main/domain/sigma-tea-core';

export { teaCriterionText } from '../../main/domain/sigma-tea-core';

export type SigmaTeaSource = SigmaTeaSourceCore;
export type ResolvedSigmaTea = Omit<ResolvedTeaCore, 'catalog'> & { catalog: TeaCatalogItem | null };

/** Adapter trình bày: catalog tĩnh và lớp phủ TEa do phòng xét nghiệm quản
 * lý được đưa vào hàm thuần; renderer không chứa công thức quy đổi. */
export function resolveSigmaTea(test: Test, refs: TeaRef[], source: SigmaTeaSource, targetMean?: number | null): ResolvedSigmaTea {
  return resolveTea(test, refs, TEA_CATALOG_WITH_CLIA_ABSOLUTE, source, targetMean);
}

