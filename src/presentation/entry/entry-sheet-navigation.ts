export type EntrySheetKey = 'ArrowLeft' | 'ArrowRight' | 'Tab' | 'ArrowUp' | 'ArrowDown' | 'Enter';

export function createEntrySheetNavigation<T>(deps: { date: (item: T) => string; run: (item: T) => string; level: (item: T) => string }) {
  const target = (inputs: readonly T[] | null | undefined, current: T, key: EntrySheetKey, shiftKey = false): T | null => {
    const available = inputs || [];
    if (!available.length || !available.includes(current)) return null;
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') {
      const row = available.filter(item => deps.date(item) === deps.date(current) && deps.run(item) === deps.run(current));
      const index = row.indexOf(current);
      const step = key === 'ArrowLeft' || (key === 'Tab' && shiftKey) ? -1 : 1;
      if (index < 0 || row.length < 2) return null;
      return key === 'Tab' ? row[(index + step + row.length) % row.length] : row[index + step] || null;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter') {
      const column = available.filter(item => deps.level(item) === deps.level(current));
      const index = column.indexOf(current);
      const step = key === 'ArrowUp' ? -1 : 1;
      if (index < 0 || column.length < 2) return null;
      return key === 'Enter' ? column[(index + 1) % column.length] : column[index + step] || null;
    }
    return null;
  };
  return Object.freeze({ target });
}
