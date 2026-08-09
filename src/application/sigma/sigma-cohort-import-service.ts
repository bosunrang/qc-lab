type Value = Record<string, any>;

export function createSigmaCohortImportService(deps: { assess: (cohort: Value) => Value; setTeaSnapshot: (test: Value, entry: Value, level: number, force: boolean) => void; isCurrentPeriod: (period: string) => boolean }) {
  const clearImportedCv = (level: Value) => {
    if (!level || !['iqc-period', 'iqc-cohort'].includes(level.cvSource)) return false;
    ['cv', 'cvSource', 'n', 'sourceStart', 'sourceEnd', 'sourceLot', 'cohortStatus', 'cohortIssues', 'sourceExcludedVoided', 'sourceExcludedInvalid', 'sourceTargetMean', 'sourceTargetSd'].forEach(key => delete level[key]);
    return true;
  };
  const importCohort = (test: Value, entry: Value, level: number, cohort: Value | undefined) => {
    entry.lv = entry.lv || {}; const existing = entry.lv[level] || {}, force = deps.isCurrentPeriod(entry.period);
    if (!(cohort && cohort.stats?.n >= 2 && cohort.stats.cv > 0)) { const cleared = clearImportedCv(existing); if (cleared) deps.setTeaSnapshot(test, entry, level, force); return { imported: false, cleared }; }
    const data = entry.lv[level] = existing, assessment = deps.assess(cohort);
    ['sourceTargetMean', 'sourceTargetSd', 'cohortIssues', 'sourceExcludedVoided', 'sourceExcludedInvalid'].forEach(key => delete data[key]);
    Object.assign(data, { cv: cohort.stats.cv, cvSource: 'iqc-cohort', n: cohort.stats.n, sourceStart: cohort.start, sourceEnd: cohort.end, sourceLot: cohort.lot, cohortStatus: assessment.status, cohortIssues: cohort.issues, sourceExcludedVoided: cohort.excluded.voided, sourceExcludedInvalid: cohort.excluded.invalidValue });
    if (cohort.targetMean != null && cohort.targetMean !== 0) data.sourceTargetMean = cohort.targetMean;
    if (cohort.targetSd != null && cohort.targetSd > 0) data.sourceTargetSd = cohort.targetSd;
    deps.setTeaSnapshot(test, entry, level, force);
    return { imported: true, cleared: false, status: assessment.status, mixedTarget: cohort.issues.includes('mixed-target-mean') || cohort.issues.includes('mixed-target-sd') };
  };
  const applyChoices = (test: Value, entry: Value, groups: Value[], choices?: Record<string, string>) => {
    const summary = { imported: 0, cleared: 0, insufficient: 0, unstable: 0, mixedTargets: 0, missingLotN: 0, missingLotLevels: 0 };
    (groups || []).forEach(group => {
      const cohort = (group.cohorts || []).find((item: Value) => item.lot === choices?.[group.level]);
      const result = importCohort(test, entry, group.level, cohort);
      if (result.imported) { summary.imported++; if (result.status === 'insufficient') summary.insufficient++; if (result.status === 'unstable') summary.unstable++; if (result.mixedTarget) summary.mixedTargets++; }
      if (result.cleared) summary.cleared++;
      if (group.missingLotN && !(group.cohorts || []).length) { summary.missingLotN += group.missingLotN; summary.missingLotLevels++; }
    });
    return summary;
  };
  return Object.freeze({ clearImportedCv, importCohort, applyChoices });
}
export type SigmaCohortImportService = ReturnType<typeof createSigmaCohortImportService>;
