type TargetMatrixPanelInput = { selectorHtml: string; summaryHtml: string; contentHtml: string };

export function targetMatrixPanelHtml(input: TargetMatrixPanelInput) {
  return `<div class="panel target-matrix-panel">${input.selectorHtml}${input.summaryHtml}${input.contentHtml}</div>`;
}
