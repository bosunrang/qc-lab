export function entryTreeOpenState(keys: Iterable<unknown>, key: unknown) {
  const next = new Set(keys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return { keys: next, open: next.has(key) };
}
