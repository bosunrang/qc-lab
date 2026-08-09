type Value = Record<string, any>;

const COHORT_FIELDS = ['n', 'sourceStart', 'sourceEnd', 'sourceLot', 'cohortStatus', 'cohortIssues', 'sourceExcludedVoided', 'sourceExcludedInvalid', 'sourceTargetMean', 'sourceTargetSd'];

export function createSigmaLevelEditService(deps: { cleanText: (value: unknown, maximumLength?: number) => string }) {
  const clean = (field: string, value: unknown) => {
    if (['cv', 'biasEqa'].includes(field)) { const text = String(value ?? '').trim(); if (!text) return ''; const number = Number(text); return Number.isFinite(number) ? number : ''; }
    return deps.cleanText(value, 120);
  };
  const update = (level: Value, field: string, value: unknown) => {
    level[field] = clean(field, value);
    if (field === 'biasEqa') {
      if (level.biasEqa === '') delete level.biasEqaMethod;
      else level.biasEqaMethod = 'manual';
      delete level.eqaRounds; delete level.eqaBatchId;
    }
    if (field === 'cv') {
      level.cvSource = 'manual';
      COHORT_FIELDS.forEach(key => delete level[key]);
    }
    return level;
  };
  return Object.freeze({ clean, update });
}
export type SigmaLevelEditService = ReturnType<typeof createSigmaLevelEditService>;
