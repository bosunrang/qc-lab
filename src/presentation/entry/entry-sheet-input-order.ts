export function createEntrySheetInputOrder<T>(deps: { date: (item: T) => string; run: (item: T) => number; level: (item: T) => number }) {
  return (inputs: readonly T[]) => [...inputs].sort((left, right) =>
    deps.date(left).localeCompare(deps.date(right), 'vi', { numeric: true }) || deps.run(left) - deps.run(right) || deps.level(left) - deps.level(right));
}
