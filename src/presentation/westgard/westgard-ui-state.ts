export const westgardUiState = Object.freeze({
  toggleOpen(keys: Iterable<unknown>, key: unknown) {
    const next = new Set(keys);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  },
  viewMode(mode: unknown) { return mode === 'archived' ? 'archived' : 'current'; },
  chartMode(mode: unknown) { return mode === 'cusum' ? 'cusum' : 'lj'; },
  query(value: unknown) { return String(value || ''); },
  archivedGroup(id: unknown) { return { groupId: id, testId: '' }; },
  archivedTest(id: unknown) { return { testId: id }; },
});
