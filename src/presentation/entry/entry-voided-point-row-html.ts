type EntryVoidedPointRowInput = {
  pointId: string;
  date: string;
  levelLot: string;
  value: string;
  runId: string;
  voidedBy: string;
  reason: string;
};

type EntryVoidedPointRowDependencies = { escape: (value: unknown) => string };

export function createEntryVoidedPointRowHtml(deps: EntryVoidedPointRowDependencies) {
  return (input: EntryVoidedPointRowInput) => `<tr data-qc-point-id="${deps.escape(input.pointId)}" tabindex="-1"><td>${deps.escape(input.date)}</td><td>${deps.escape(input.levelLot)}</td><td class="num">${deps.escape(input.value)}</td><td>${deps.escape(input.runId)}</td><td>${deps.escape(input.voidedBy)}</td><td>${deps.escape(input.reason)}</td></tr>`;
}
