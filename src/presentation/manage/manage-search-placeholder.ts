const PLACEHOLDERS: Record<string, string> = Object.freeze({
  instruments: 'Tìm theo tên máy, hãng, số sê-ri...',
  assays: 'Tìm theo tên xét nghiệm, máy, đơn vị, phương pháp, hóa chất, TEa...',
  panels: 'Tìm theo tên panel QC, máy và xét nghiệm...',
  lots: 'Tìm theo số lô, nhóm lô QC...',
  targets: 'Tìm theo tên xét nghiệm...',
  transitions: 'Tìm theo panel QC, lô cũ/mới...',
  history: 'Tìm theo xét nghiệm, mức, lô QC...',
  tearefs: 'Tìm theo tên xét nghiệm, nhóm, đơn vị...',
});

export function manageSearchPlaceholder(tab: string) {
  return PLACEHOLDERS[tab] || '';
}
