type Value = Record<string, any>;

export function createRangeTea(deps: { teaBySource: (test: Value, source: unknown, target: unknown) => unknown; teaSource: (test: Value) => unknown }) {
  const percent = (test: Value | null | undefined, level: Value | null | undefined) => {
    const value = test && level ? deps.teaBySource(test, deps.teaSource(test), level.mean) : 0;
    return Number.isFinite(value) && Number(value) > 0 ? Number(value) : null;
  };
  const quarter = (teaPercent: number | null | undefined) => teaPercent != null && teaPercent > 0 ? teaPercent / 4 : null;
  return Object.freeze({ percent, quarter });
}
