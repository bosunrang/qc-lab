export function entryRowsWindow<T>(rows: readonly T[] | null | undefined, expanded: boolean, initialRows: number) {
  const all = rows || [];
  const visible = expanded ? all : all.slice(-initialRows);
  return { rows: visible, total: all.length, limited: visible.length < all.length, expanded };
}

export function entryLotLabels(levels: readonly { lot?: unknown }[] | null | undefined) {
  const lots = (levels || []).map(level => String(level.lot || '').trim()).filter(Boolean);
  return lots.join(' / ') || 'Chưa gán lô';
}
