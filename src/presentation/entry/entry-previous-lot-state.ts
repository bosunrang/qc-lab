export function entryPreviousLotState(values: Iterable<readonly [unknown, unknown]>, key: unknown, lot: unknown = null) {
  const next = new Map(values);
  if (lot == null || lot === '') next.delete(key);
  else next.set(key, lot);
  return next;
}
