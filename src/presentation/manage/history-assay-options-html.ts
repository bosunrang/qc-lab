export function historyAssayOptionsHtml<T extends { id: string }>(assays: T[], selectedId: string, displayName: (assay: T) => string, escape: (value: unknown) => string) {
  return assays.map(assay => `<option value="${assay.id}" ${assay.id === selectedId ? 'selected' : ''}>${escape(displayName(assay))}</option>`).join('');
}
