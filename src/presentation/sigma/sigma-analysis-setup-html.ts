export type SigmaAnalysisSetupInput = { testSelectHtml: string; fieldsHtml: string; eflmHtml: string; hintHtml: string };

export function sigmaAnalysisSetupHtml(input: SigmaAnalysisSetupInput) {
  return `<div class="panel"><h2 class="sg-setup-heading panel-title">Thiết lập phân tích</h2><div class="row-flex sg-control-row">${input.testSelectHtml}</div><div class="sg-setup-fields">${input.fieldsHtml}</div>${input.eflmHtml}<div class="hint sg-sigma-input-note">${input.hintHtml}</div></div>`;
}
