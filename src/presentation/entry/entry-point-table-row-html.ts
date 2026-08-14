type EntryPointTableRowInput = { rejected: boolean; warning: boolean; pointId: string; dateText: string; valueText: string; zText: string; verdictLevel: string; verdictText: string; rulesHtml: string; voidButtonHtml: string };

export function entryPointTableRowHtml(input: EntryPointTableRowInput) {
  const rowClass = input.rejected ? ' class="qc-point-rej"' : input.warning ? ' class="qc-point-warn"' : '';
  return `<tr${rowClass} data-qc-point-id="${input.pointId}" tabindex="-1"><td>${input.dateText}</td><td class="num"><b>${input.valueText}</b></td><td class="num">${input.zText}</td><td><span class="tag ${input.verdictLevel}">${input.verdictText}</span></td><td>${input.rulesHtml}</td><td class="qc-row-actions">${input.voidButtonHtml}</td></tr>`;
}
