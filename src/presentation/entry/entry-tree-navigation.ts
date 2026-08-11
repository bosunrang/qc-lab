export type EntryTreeNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

export function createEntryTreeNavigation<T>() {
  const target = (items: readonly T[] | null | undefined, current: T, key: EntryTreeNavigationKey): T | null => {
    const visible = items || [];
    const index = visible.indexOf(current);
    if (index < 0 || !visible.length) return null;
    if (key === 'Home') return visible[0] || null;
    if (key === 'End') return visible[visible.length - 1] || null;
    const step = key === 'ArrowDown' ? 1 : -1;
    return visible[(index + step + visible.length) % visible.length] || null;
  };
  return Object.freeze({ target });
}
