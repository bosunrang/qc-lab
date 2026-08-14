type EntrySheetCellInput = { parallel: boolean; hasAddButton: boolean; runInputsHtml: string; addRunButtonHtml: string };

export function entrySheetCellHtml(input: EntrySheetCellInput) {
  return `<td class="num qc-run-cell${input.parallel ? ' qc-parallel-cell' : ''}"><div class="qc-run-grid${input.hasAddButton ? ' has-add-btn' : ''}">${input.runInputsHtml}</div>${input.addRunButtonHtml}</td>`;
}
