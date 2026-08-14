export type SigmaMuStateChipInput = { hasMu: boolean; complete?: boolean; missingHtml?: string };

export function sigmaMuStateChipHtml(input: SigmaMuStateChipInput) {
  if(!input.hasMu)return '<span class="tag none">Chưa có CV IQC</span>';
  if(!input.complete)return `<span class="tag warn">Thiếu ${input.missingHtml||''}</span>`;
  return '<span class="tag ok">Đủ thành phần</span>';
}
