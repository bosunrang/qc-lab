export type SigmaNoLevelsPanelInput = { testSelectHtml: string; messageHtml: string };

export function sigmaNoLevelsPanelHtml(input: SigmaNoLevelsPanelInput) {
  return `<div class="panel"><div class="row-flex sg-control-row">${input.testSelectHtml}</div><div class="alert warn flow-control">${input.messageHtml}</div></div>`;
}
