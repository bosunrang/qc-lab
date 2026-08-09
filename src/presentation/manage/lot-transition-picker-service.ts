type Lot = Record<string, any>;

export type LotTransitionPickerDependencies = {
  searchText: (value: unknown) => string;
  formatDate: (value: unknown) => string;
  transitionToNo: (lotId: string) => string;
};

export function createLotTransitionPickerService({ searchText, formatDate, transitionToNo }: LotTransitionPickerDependencies) {
  function label(lot: Lot | null | undefined) {
    if (!lot) return '';
    const nextLot = lot.depleted ? transitionToNo(lot.id) : '';
    return `${lot.lotNo} · Mức ${lot.level}${lot.exp ? ' · HSD ' + formatDate(lot.exp) : ''}${lot.depleted ? ' · ' + (nextLot ? 'đã chuyển tiếp qua lô ' + nextLot : 'đã hết QC') : ''}`;
  }
  function availableLots(lots: Lot[], selectedId = '') { return (lots || []).filter(lot => !lot.depleted || lot.id === selectedId); }
  function match(lots: Lot[], value: unknown, selectedId = '') {
    const query = searchText(value); if (!query) return null;
    const choices = availableLots(lots, selectedId);
    const exact = choices.find(lot => searchText(label(lot)) === query || searchText(lot.lotNo) === query);
    if (exact) return exact;
    const matches = choices.filter(lot => searchText(label(lot)).includes(query));
    return matches.length === 1 ? matches[0] : null;
  }
  return Object.freeze({ label, availableLots, match });
}

export type LotTransitionPickerServiceApi = ReturnType<typeof createLotTransitionPickerService>;
