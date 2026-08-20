type ReagentPickerModalInput = {
  searchValueHtml: string;
  rowsHtml: string;
  closeButtonHtml: string;
};

export function reagentPickerModalHtml(input: ReagentPickerModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Chọn phép so sánh</h3><button class="modal-close" data-action="closeModal">✕</button></div>
    <div class="modal-b"><input id="rcModalSearch" placeholder="Tìm phép so sánh..." value="${input.searchValueHtml}" data-action="rcModalSearchSet" data-action-on="input">
      <div class="flow-control">${input.rowsHtml}</div></div>
    <div class="modal-f">${input.closeButtonHtml}</div></div>`;
}
