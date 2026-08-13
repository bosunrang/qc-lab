export function createEntrySheetPendingFocus<T>(deps: {
  date: (item: T) => string;
  level: (item: T) => string;
  choose: (items: readonly T[]) => T | null;
}) {
  return (pending: unknown, candidates: readonly T[]) => {
    const [date, level] = String(pending || '').split('|');
    if (!date || !level) return null;
    return deps.choose(candidates.filter(item => deps.date(item) === date && deps.level(item) === level));
  };
}
