export function entryDetailState(keys: Iterable<unknown>, key: unknown, open: boolean) {
  const next = new Set(keys);
  if (open) next.add(key);
  else next.delete(key);
  return next;
}
