type HistoryPanelInput = { selectorHtml: string; tableHtml: string };

export function historyPanelHtml(input: HistoryPanelInput) {
  return `<div class="panel target-matrix-panel">${input.selectorHtml}${input.tableHtml}</div>`;
}
