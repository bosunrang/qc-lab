export function createQcPointVoidVerdict(deps: {
  configuredLot: (test: Record<string, any>, level: unknown) => string;
  activeVerdict: (test: Record<string, any>, pointId: string) => Record<string, any> | undefined;
  parallelVerdict: (test: Record<string, any>, input: Record<string, any>, pointId: string) => Record<string, any> | undefined;
}) {
  return (test: Record<string, any> | null | undefined, point: Record<string, any> | null | undefined) => {
    if (!test || !point) return { level: 'ok', rules: [] };
    if (point.lot && String(point.lot) !== String(deps.configuredLot(test, point.level))) {
      return deps.parallelVerdict(test, { level: point.level, lot: point.lot, mean: Number(point.qcMean), sd: Number(point.qcSd), parallel: true }, point.id) || { level: 'ok', rules: [] };
    }
    return deps.activeVerdict(test, point.id) || { level: 'ok', rules: [] };
  };
}
