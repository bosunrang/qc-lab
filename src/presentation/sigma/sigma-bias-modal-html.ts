export type SigmaBiasModalInput = { level: number; rowsHtml: string; periodRowsHtml: string; addRoundButtonHtml: string; selectAllButtonHtml: string; clearSelectionButtonHtml: string; cancelButtonHtml: string; applyButtonHtml: string };

export function sigmaBiasModalHtml(input: SigmaBiasModalInput) {
  return `<div class="modal sg-eqa-modal"><div class="modal-h"><h3>Tính Bias% từ EQA/EQC — Mức ${input.level}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><div class="sg-eqa-table-wrap"><table class="sg-eqa-table"><thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${input.rowsHtml}</tbody></table></div>
      ${input.addRoundButtonHtml}<div id="sgBiasSummary" class="sg-eqa-summary alert info"></div>
      <div class="sg-eqa-period-wrap"><div class="sg-eqa-period-head"><b>Áp dụng cho kỳ nào?</b><div>${input.selectAllButtonHtml}${input.clearSelectionButtonHtml}</div></div><div class="sg-eqa-period-list">${input.periodRowsHtml}</div></div></div>
    <div class="modal-f">${input.cancelButtonHtml}${input.applyButtonHtml}</div></div>`;
}
