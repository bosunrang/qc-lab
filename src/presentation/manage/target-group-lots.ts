export function targetGroupLots<T extends { id: string; level?: number; lotNo?: string }>(lots: T[], group?: { lotIds?: string[] }) {
  return (group?.lotIds || []).map(id => lots.find(lot => lot.id === id)).filter((lot): lot is T => !!lot).sort((left, right) => Number(left.level || 0) - Number(right.level || 0) || String(left.lotNo || '').localeCompare(String(right.lotNo || ''), 'vi', { numeric: true }));
}
