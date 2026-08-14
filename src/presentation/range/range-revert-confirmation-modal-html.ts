export type RangeRevertConfirmationModalInput = { cancelButtonHtml: string; revertButtonHtml: string };

export function rangeRevertConfirmationModalHtml(input: RangeRevertConfirmationModalInput) {
  return `<div class="modal">
    <div class="modal-h"><h3>Hoàn về dải nhà sản xuất?</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <label>Lý do/căn cứ hoàn về dải nhà sản xuất (tối thiểu 5 ký tự)</label>
      <textarea id="rangeReasonInput" placeholder="VD: Dải PXN không còn phù hợp, hoàn theo yêu cầu..." oninput="document.getElementById('rangeReasonErr').style.display='none'"></textarea>
      <div id="rangeReasonErr" class="hint field-error">Cần ghi lý do tối thiểu 5 ký tự.</div>
    </div>
    <div class="modal-f">${input.cancelButtonHtml}${input.revertButtonHtml}</div>
  </div>`;
}
