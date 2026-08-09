type Value = Record<string, any>;

export function createSigmaPeriodSelectionService() {
  const resolve = (selectedId: string | null | undefined, entries: Value[]) => {
    if (selectedId && entries.some(entry => entry.id === selectedId)) return selectedId;
    return [...entries].sort((left, right) => String(left.period || '').localeCompare(String(right.period || ''))).pop()?.id || '';
  };
  const select = (selectedId: string | null | undefined, entries: Value[], nextId: string) => {
    if (!entries.some(entry => entry.id === nextId) || selectedId === nextId) return { changed: false, selected: selectedId || '' };
    return { changed: true, selected: nextId };
  };
  return Object.freeze({ resolve, select });
}
export type SigmaPeriodSelectionService = ReturnType<typeof createSigmaPeriodSelectionService>;
