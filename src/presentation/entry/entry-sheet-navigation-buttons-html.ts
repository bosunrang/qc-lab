type EntrySheetNavigationButtonsDependencies = { button: (label: string, action: string, variant: string) => string };

export function createEntrySheetNavigationButtonsHtml(deps: EntrySheetNavigationButtonsDependencies) {
  return () => deps.button('Tháng hiện tại', 'entrySetSheetMonth(isoMonth())', 'ghost sm qc-current-month') + deps.button('Tới hôm nay', 'entryGoToday()', 'teal sm qc-today-jump');
}
