export function historyAssaySelection<T extends { id: string }>(assays: T[], selectedId: string) {
  const assay = assays.find(item => item.id === selectedId) || assays[0];
  return { selectedId: assay?.id || '', assay };
}
