type EntrySavedRunInput = {
  previousLot: boolean;
  previousLotNo: string;
  valueClass: string;
  valueTitle: string;
  value: string;
  z: string;
  label: string;
};

type EntrySavedRunDependencies = { escape: (value: unknown) => string };

export function createEntrySavedRunHtml(deps: EntrySavedRunDependencies) {
  return (input: EntrySavedRunInput) => `<div class="qc-run-slot${input.previousLot ? ' prev-lot-slot' : ''}"><b class="qc-value-chip ${deps.escape(input.valueClass)}" title="${deps.escape(input.valueTitle)}">${deps.escape(input.value)}</b><small>${deps.escape(input.z)}s · ${input.previousLot ? 'Lô ' + deps.escape(input.previousLotNo) : deps.escape(input.label)}</small></div>`;
}
