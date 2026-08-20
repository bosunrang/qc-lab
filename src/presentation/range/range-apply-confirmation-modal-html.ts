export type RangeApplyConfirmationModalInput = { changeSummaryHtml: string; gateHtml: string; cancelButtonHtml: string; applyButtonHtml: string };

export function rangeApplyConfirmationModalHtml(input: RangeApplyConfirmationModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Áp dụng dải PXN mới?</h3><button class="modal-close" data-action="closeModal">×</button></div>
    <div class="modal-b">
      <div class="hint">${input.changeSummaryHtml}</div>
      ${input.gateHtml}
      <label class="flow-control">Căn cứ/phê duyệt (SOP, người duyệt hoặc biên bản — tối thiểu 10 ký tự)</label>
      <textarea id="rangeReasonInput" placeholder="VD: Theo SOP-XXX, phê duyệt bởi..." data-action="hideFieldError" data-args='["rangeReasonErr"]' data-action-on="input"></textarea>
      <div id="rangeReasonErr" class="hint field-error">Cần ghi căn cứ phê duyệt tối thiểu 10 ký tự.</div>
    </div>
    <div class="modal-f">${input.cancelButtonHtml}${input.applyButtonHtml}</div>
  </div>`;
}
