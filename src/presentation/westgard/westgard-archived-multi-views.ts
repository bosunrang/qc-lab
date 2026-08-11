export type WestgardArchivedLevel = { level?: unknown };
export type WestgardArchivedLot = { lotNo?: unknown };
export type WestgardArchivedChartRow<TTest = unknown> = {
  t: TTest; l: WestgardArchivedLevel; lot: WestgardArchivedLot; mean: unknown; sd: unknown;
};

export function westgardArchivedMultiViews<TTest, TPoint>(
  rows: readonly WestgardArchivedChartRow<TTest>[] | null | undefined,
  lotPoints: (test: TTest, level: unknown, lotNo: unknown) => TPoint[],
) {
  return (rows || []).map(row => ({
    level: row.l.level, lot: row.lot.lotNo, mean: row.mean, sd: row.sd,
    pts: lotPoints(row.t, row.l.level, row.lot.lotNo), label: `M${row.l.level}·${row.lot.lotNo}`,
  }));
}
