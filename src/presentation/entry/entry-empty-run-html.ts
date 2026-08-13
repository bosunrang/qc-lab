type EntryEmptyRunInput = {
  canWrite: boolean;
  dateLabel: string;
  level: number;
  lot: string;
  runNumber: number;
  focusDate: string;
  focusLevel: number;
  runId: string;
  testId: string;
  saveLot: string;
};

type EntryEmptyRunDependencies = { escape: (value: unknown) => string };

export function createEntryEmptyRunHtml(deps: EntryEmptyRunDependencies) {
  return (input: EntryEmptyRunInput) => !input.canWrite ? '<div class="qc-run-slot muted"><b>—</b></div>' : `<div class="qc-run-slot"><input class="qc-inline-input empty" type="text" inputmode="decimal" autocomplete="off" placeholder="--" title="Dùng phím mũi tên để chuyển ô" aria-label="Nhập QC ngày ${deps.escape(input.dateLabel)}, mức ${input.level}, lô ${deps.escape(input.lot)}, lần ${input.runNumber}" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" data-focus-date="${deps.escape(input.focusDate)}" data-focus-run="${input.runNumber}" data-focus-level="${input.focusLevel}" onkeydown="entrySheetKey(event)" onchange="entryInlineSave('${deps.escape(input.testId)}',${input.level},'${deps.escape(input.focusDate)}',this.value,'${deps.escape(input.runId)}','${deps.escape(input.saveLot)}')"></div>`;
}
