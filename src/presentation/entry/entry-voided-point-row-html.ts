type EntryVoidedPointRowInput = { pointId: string; dateText: string; levelLotText: string; valueText: string; runId: string; voidedBy: string; reason: string };

export function entryVoidedPointRowHtml(input: EntryVoidedPointRowInput) {
  return `<tr data-qc-point-id="${input.pointId}" tabindex="-1"><td>${input.dateText}</td><td>${input.levelLotText}</td><td class="num">${input.valueText}</td><td>${input.runId}</td><td>${input.voidedBy}</td><td>${input.reason}</td></tr>`;
}
