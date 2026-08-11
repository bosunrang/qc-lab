export function entryExpandedTablesToggle(keys: Iterable<unknown>, key: unknown, limit = 24) {
  const next = [...keys];
  const index = next.indexOf(key);
  if (index >= 0) { next.splice(index, 1); return next; }
  next.push(key);
  return next.slice(-Math.max(1, limit));
}
