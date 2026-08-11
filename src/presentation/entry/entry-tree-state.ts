type Value = Record<string, any>;

export function createEntryTreeState(deps: {
  activeWestgard: (test: Value) => { byPoint: Map<unknown, Value> };
  operationalLevels: (test: Value) => Value[];
  pointsForLot: (testId: unknown, level: unknown, lot: string) => Value[];
}) {
  return (test: Value | null | undefined) => {
    if (!test) return 'none';
    const order: Record<string, number> = { none: -1, ok: 0, warn: 1, rej: 2 };
    const westgard = deps.activeWestgard(test);
    let worst = 'none';
    deps.operationalLevels(test).forEach(level => {
      const points = deps.pointsForLot(test.id, level.level, level.lot || '');
      const last = points[points.length - 1];
      const verdict = (last && westgard.byPoint.get(last.id) || {}).level || 'none';
      if ((order[verdict] ?? -1) > order[worst]) worst = verdict;
    });
    return worst;
  };
}
