export type SigmaMuPreviewInput = { hasMu: boolean; ucText?: string; uText?: string; complete?: boolean; missingHtml?: string };

export function sigmaMuPreviewHtml(input: SigmaMuPreviewInput) {
  if(!input.hasMu)return '<div class="sg-mu-preview-empty">Chưa có CV IQC</div>';
  const state=input.complete?'Đủ thành phần':`Thiếu ${input.missingHtml||''}`;
  return `<div class="sg-mu-preview-values"><span><small>u<sub>c</sub></small><b>${input.ucText}%</b></span><span class="is-u"><small>U (k=2)</small><b>${input.uText}%</b></span></div><div class="sg-mu-preview-state ${input.complete?'ok':'warn'}">${state}</div>`;
}
