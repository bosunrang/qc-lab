type EntryPointRowInput = {
  pointId: string;
  rejected: boolean;
  warned: boolean;
  date: string;
  value: string;
  z: string;
  verdictClass: string;
  verdictLabel: string;
  rulesHtml: string;
  voidButtonHtml: string;
};

type EntryPointRowDependencies = { escape: (value: unknown) => string };

export function createEntryPointRowHtml(deps: EntryPointRowDependencies) {
  return (input: EntryPointRowInput) => `<tr${input.rejected ? ' class="qc-point-rej"' : input.warned ? ' class="qc-point-warn"' : ''} data-qc-point-id="${deps.escape(input.pointId)}" tabindex="-1"><td>${deps.escape(input.date)}</td><td class="num"><b>${deps.escape(input.value)}</b></td><td class="num">${deps.escape(input.z)}s</td><td><span class="tag ${deps.escape(input.verdictClass)}">${deps.escape(input.verdictLabel)}</span></td><td>${input.rulesHtml}</td><td class="qc-row-actions">${input.voidButtonHtml}</td></tr>`;
}
