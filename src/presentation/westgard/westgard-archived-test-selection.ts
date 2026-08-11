export type WestgardArchivedSelectableTest = { id?: unknown; name?: unknown; instrumentId?: unknown; machine?: unknown };
export type WestgardArchivedTestEntry<TTest extends WestgardArchivedSelectableTest> = { t: TTest };

export type WestgardArchivedTestSelectionDeps<TTest extends WestgardArchivedSelectableTest> = {
  searchText: (value: unknown) => string;
  testDisplayName: (test: TTest) => unknown;
  instrumentName: (instrumentId: unknown, machine: unknown) => unknown;
};

export function westgardArchivedTestSelection<TTest extends WestgardArchivedSelectableTest, TEntry extends WestgardArchivedTestEntry<TTest>>(
  entries: readonly TEntry[] | null | undefined,
  query: string,
  selectedId: unknown,
  deps: WestgardArchivedTestSelectionDeps<TTest>,
) {
  const all = entries || [];
  const matched = all.filter(entry => !query || deps.searchText(entry.t.name).includes(query) ||
    deps.searchText(deps.testDisplayName(entry.t)).includes(query) || deps.searchText(deps.instrumentName(entry.t.instrumentId, entry.t.machine)).includes(query));
  const list = matched.length ? matched : all;
  const selected = matched.length && !matched.some(entry => entry.t.id === selectedId) ? matched[0].t.id :
    !all.some(entry => entry.t.id === selectedId) ? all[0]?.t.id : selectedId;
  return { matched, list, selected, entry: all.find(item => item.t.id === selected) || all[0] };
}
