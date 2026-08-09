type Value = Record<string, any>;

const sortedLevels = (values: Set<number>) => [...values].sort((left, right) => left - right);
const addLevel = (values: Set<number>, value: unknown) => { const level = Number(value); if (Number.isFinite(level) && level > 0) values.add(level); };

export function createSigmaLevelSelectionService() {
  const historical = (test: Value | null, points: Value[], entries: Value[], operational: (test: Value) => Value[]) => {
    const levels = new Set<number>();
    if (test) operational(test).forEach(level => addLevel(levels, level.level));
    (test?.levels || []).forEach((level: Value) => { if (level.qcLotId || (Number.isFinite(+level.sd) && +level.sd > 0) || (level.meanSdHistory || []).length) addLevel(levels, level.level); });
    (points || []).forEach(point => addLevel(levels, point?.level));
    (entries || []).forEach(entry => Object.keys(entry?.lv || {}).forEach(level => addLevel(levels, level)));
    return sortedLevels(levels);
  };
  const period = (test: Value | null, entry: Value, points: Value[], entries: Value[], operational: (test: Value) => Value[], normalizePeriod: (value: unknown) => string, cutoff: (period: unknown) => string) => {
    const levels = new Set<number>(), normalized = normalizePeriod(entry?.period), start = normalized ? `${normalized}-01` : '', end = normalized ? cutoff(normalized) : '';
    Object.keys(entry?.lv || {}).forEach(level => addLevel(levels, level));
    (points || []).forEach(point => { const date = String(point?.date || ''); if ((!start || date >= start) && (!end || date <= end)) addLevel(levels, point?.level); });
    if (!levels.size) historical(test, points, entries, operational).forEach(level => levels.add(level));
    return sortedLevels(levels);
  };
  return Object.freeze({ historical, period });
}
export type SigmaLevelSelectionService = ReturnType<typeof createSigmaLevelSelectionService>;
