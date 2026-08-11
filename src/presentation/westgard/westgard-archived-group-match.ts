export type WestgardArchivedSearchGroup = { name?: unknown; lotIds?: readonly unknown[] | null };
export type WestgardSearchLot = { lotNo?: unknown };

export function westgardArchivedGroupMatches<TLot extends WestgardSearchLot>(
  group: WestgardArchivedSearchGroup | null | undefined,
  query: string,
  searchText: (value: unknown) => string,
  lotById: (id: unknown) => TLot | null | undefined,
): boolean {
  if (!query) return true;
  if (searchText(group?.name).includes(query)) return true;
  return (group?.lotIds || []).some(id => {
    const lot = lotById(id);
    return !!lot && searchText(lot.lotNo).includes(query);
  });
}
