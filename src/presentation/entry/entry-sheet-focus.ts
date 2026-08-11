export function createEntrySheetFocus<T>(isEmpty: (item: T) => boolean) {
  return (candidates: readonly T[] | null | undefined): T | null => {
    const items = candidates || [];
    return items.find(isEmpty) || items[0] || null;
  };
}
