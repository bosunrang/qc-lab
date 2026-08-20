type ReagentQuickPickerModalInput = {
  labelHtml: string;
  rowsHtml: string;
  placeholderHtml: string;
  addButtonHtml: string;
  closeButtonHtml: string;
};

export function reagentQuickPickerModalHtml(input: ReagentQuickPickerModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Chọn nhanh ${input.labelHtml}</h3><button class="modal-close" data-action="closeModal">✕</button></div>
    <div class="modal-b">${input.rowsHtml}<div class="rc-quick-add"><input id="rcQuickNew" placeholder="Thêm ${input.placeholderHtml} mới" data-keydown-action="rcAddQuick" data-keydown-keys='["Enter"]'>${input.addButtonHtml}</div></div>
    <div class="modal-f">${input.closeButtonHtml}</div></div>`;
}
