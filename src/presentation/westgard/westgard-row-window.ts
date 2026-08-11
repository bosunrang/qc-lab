export function westgardRowsWindow<T>(rows: readonly T[] | null | undefined, expanded: boolean, initialRows = 120) {
  const all = Array.isArray(rows) ? rows : [];
  const limit = Number.isInteger(initialRows) && initialRows > 0 ? initialRows : 120;
  const visible = expanded ? all : all.slice(-limit);
  return { rows: visible, total: all.length, expanded: !!expanded, limited: visible.length < all.length };
}
