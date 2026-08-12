export function historySummary<T extends { pts?: unknown[] }>(rows: T[]) {
  return { rowCount: rows.length, pointCount: rows.reduce((count, row) => count + (row.pts?.length || 0), 0) };
}
