export function entryTreeAutoOpenState(keys: Iterable<unknown>, previousKey: unknown, machine: unknown, lotGroupKey: unknown, testId: unknown) {
  const autoOpenKey = `${machine}|${lotGroupKey}|${testId}`;
  const next = new Set(keys);
  if (previousKey === autoOpenKey) return { keys: next, autoOpenKey, changed: false };
  next.add(`m:${machine}`);
  next.add(`lg:${machine}|${lotGroupKey}`);
  return { keys: next, autoOpenKey, changed: true };
}
