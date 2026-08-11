export function createWestgardTestSearch<T>(deps: { text: (value: unknown) => string; label: (test: T) => string; id: (test: T) => unknown }) {
  const select = (tests: readonly T[] | null | undefined, query: unknown, selectedId: unknown) => {
    const normalized = deps.text(query);
    const matches = (tests || []).filter(test => !normalized || deps.text(deps.label(test)).includes(normalized));
    const selected = matches.some(test => deps.id(test) === selectedId) ? selectedId : (matches[0] ? deps.id(matches[0]) : selectedId);
    return { matches, selected, changed: selected !== selectedId };
  };
  return Object.freeze({ select });
}
