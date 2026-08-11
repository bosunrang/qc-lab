export function createDashboardLatestPoint<T extends Record<string, any>>(deps: { runNumber: (point: T) => number }) {
  return (points: T[]) => { const sorted = points.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''), 'vi', { numeric: true }) || deps.runNumber(a) - deps.runNumber(b)); return sorted[sorted.length - 1]; };
}
