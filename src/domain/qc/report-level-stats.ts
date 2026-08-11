export function createReportLevelStats(stats: (values: number[]) => Record<string, any>) {
  return (points: Record<string, any>[], mean: number, teaValue: number) => {
    const summary = stats(points.map(point => point.val)), denominator = Math.abs(Number(mean));
    const bias = denominator ? Math.abs(summary.m - mean) / denominator * 100 : 0;
    const te = bias + 1.65 * summary.cv, sigma = summary.cv > 0 && teaValue ? (teaValue - bias) / summary.cv : null;
    return { st: summary, bias, te, sigma };
  };
}
