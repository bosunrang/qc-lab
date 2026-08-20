type ReagentCreateModalInput = {
  searchValueHtml: string;
  createTypedHtml: string;
  referenceRowsHtml: string;
  emptyReferenceHtml: string;
  closeButtonHtml: string;
};

export function reagentCreateModalHtml(input: ReagentCreateModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Thêm hóa chất</h3><button class="modal-close" data-action="closeModal">✕</button></div>
    <div class="modal-b"><input id="rcCreateSearch" placeholder="Tìm xét nghiệm hoặc gõ tên hóa chất mới..." value="${input.searchValueHtml}" data-action="rcCreateSearchSet" data-action-on="input" data-keydown-action="rcCreateFrom" data-keydown-keys='["Enter"]'>
      <div class="flow-control">${input.createTypedHtml}</div>
      <div class="refcat">Danh mục chuẩn</div>${input.referenceRowsHtml || input.emptyReferenceHtml}</div>
    <div class="modal-f">${input.closeButtonHtml}</div></div>`;
}
