type EntryRunCellInput = { parallel: boolean; runInputsHtml: string; addRunButtonHtml: string };

export function createEntryRunCellHtml() {
  return (input: EntryRunCellInput) => `<td class="num qc-run-cell${input.parallel ? ' qc-parallel-cell' : ''}"><div class="qc-run-grid${input.addRunButtonHtml ? ' has-add-btn' : ''}">${input.runInputsHtml}</div>${input.addRunButtonHtml}</td>`;
}
