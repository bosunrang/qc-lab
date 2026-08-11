type Value = Record<string, any>;

export function createEntryColumnConfig(deps: {
  levelConfig: (test: Value, level: number) => Value | undefined;
  parallelLot: (test: Value, level: number) => Value | null | undefined;
}) {
  return (test: Value | null | undefined, level: unknown, lotNo: unknown) => {
    const config = test && deps.levelConfig(test, Number(level));
    if (!config) return null;
    if (!lotNo || String(lotNo) === String(config.lot || '')) return config;
    const parallel = deps.parallelLot(test, Number(level));
    if (!parallel || String(parallel.lotNo) !== String(lotNo)) return null;
    return {
      level: config.level, lot: parallel.lotNo, mean: parallel.mean, sd: parallel.sd,
      low: parallel.low, high: parallel.high, exp: parallel.exp, meanSdHistory: [], applied: 'mfg',
    };
  };
}
