type HistoryRow = { l: { level?: number | string }; lotNo?: string };

export function historyVisibleRows<T extends HistoryRow>(rows: T[], assayName: string | undefined, query: string, normalize: (value: unknown) => string) {
  const needle = normalize(query);
  if (!needle) return rows;
  return rows.filter(row => [assayName, row.l.level, `M${row.l.level}`, `Mức ${row.l.level}`, row.lotNo].some(value => normalize(value).includes(needle)));
}
