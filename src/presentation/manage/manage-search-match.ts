export function manageSearchMatch(values: unknown[], query: string, normalize: (value: unknown) => string) {
  const needle = normalize(query);
  return !needle || values.some(value => normalize(value).includes(needle));
}
