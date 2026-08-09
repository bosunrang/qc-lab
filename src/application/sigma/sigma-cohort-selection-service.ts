type Value = Record<string, any>;

export function createSigmaCohortSelectionService(deps: {
  normalizePeriod: (period: unknown) => string;
  today: () => string;
  cohortsForLevelByLot: (data: Value, options: Value) => Value[];
}) {
  const cutoff = (period: unknown) => {
    const normalized = deps.normalizePeriod(period), today = deps.today();
    if (!normalized) return '';
    const [year, month] = normalized.split('-').map(Number), last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return last < today ? last : today;
  };
  const groups = (test: Value, entry: Value, levels: number[], data: Value) => {
    const endDate = cutoff(entry.period), periodStart = `${entry.period}-01`;
    return levels.map(level => {
      const raw = deps.cohortsForLevelByLot(data, { testId: test.id, level, endDate }).filter(cohort => cohort.n > 0 && cohort.end >= periodStart);
      const cohorts = raw.filter(cohort => cohort.lot), missingLotN = raw.filter(cohort => !cohort.lot).reduce((sum, cohort) => sum + cohort.n, 0);
      const saved = entry.lv && entry.lv[level] && entry.lv[level].sourceLot, latest = cohorts[cohorts.length - 1], config = (test.levels || []).find((item: Value) => +item.level === +level);
      return { level, configuredLot: String(saved || (latest && latest.lot) || (config && config.lot) || ''), cohorts, missingLotN };
    });
  };
  return Object.freeze({ cutoff, groups });
}
export type SigmaCohortSelectionService = ReturnType<typeof createSigmaCohortSelectionService>;
