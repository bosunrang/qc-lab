export function westgardRowsWindow<T>(rows: readonly T[] | null | undefined, visibleCount: number, initialRows = 120) {
  const all = Array.isArray(rows) ? rows : [];
  const fallback = Number.isInteger(initialRows) && initialRows > 0 ? initialRows : 120;
  const requested = Number.isInteger(visibleCount) && visibleCount > 0 ? visibleCount : fallback;
  const count = Math.min(requested, all.length);
  const visible = all.slice(all.length - count);
  return { rows: visible, total: all.length, visibleCount: count, limited: visible.length < all.length };
}
