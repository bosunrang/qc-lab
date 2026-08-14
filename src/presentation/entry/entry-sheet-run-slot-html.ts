type EntrySheetEmptyRunInput = { editable: boolean; title: string; ariaLabel: string; date: string; runNo: number; levelIndex: number; changeAction: string };
type EntrySheetSavedRunInput = { previousLot: boolean; previousLotName: string; valueClass: string; title: string; valueText: string; zText: string; verdictText: string };

export function entrySheetEmptyRunHtml(input: EntrySheetEmptyRunInput) {
  if (!input.editable) return '<div class="qc-run-slot muted"><b>—</b></div>';
  return `<div class="qc-run-slot"><input class="qc-inline-input empty" type="text" inputmode="decimal" autocomplete="off" placeholder="--" title="${input.title}" aria-label="${input.ariaLabel}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" data-focus-date="${input.date}" data-focus-run="${input.runNo}" data-focus-level="${input.levelIndex}" onkeydown="entrySheetKey(event)" onchange="${input.changeAction}"></div>`;
}

export function entrySheetSavedRunHtml(input: EntrySheetSavedRunInput) {
  return `<div class="qc-run-slot${input.previousLot ? ' prev-lot-slot' : ''}"><b class="qc-value-chip ${input.valueClass}" title="${input.title}">${input.valueText}</b><small>${input.zText} · ${input.previousLot ? `Lô ${input.previousLotName}` : input.verdictText}</small></div>`;
}
