export function createDashboardLatestPointText(deps: { date: (value: unknown) => string; pointValue: (point: unknown, test: unknown) => string }) {
  return (point: Record<string, any> | undefined, test: unknown) => point ? `${deps.date(point.date)} · M${point._level} · ${deps.pointValue(point, test)}` : 'Chưa có điểm';
}
