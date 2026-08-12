type HistoryRow = { l: { level?: number | string }; lotNo?: string; h: { effectiveFrom?: string } };

export function sortHistoryRows<T extends HistoryRow>(rows: T[]) {
  return rows.sort((left, right) => Number(left.l.level) - Number(right.l.level)
    || (left.lotNo || '').localeCompare(right.lotNo || '', 'vi')
    || String(left.h.effectiveFrom || '').localeCompare(String(right.h.effectiveFrom || '')));
}
