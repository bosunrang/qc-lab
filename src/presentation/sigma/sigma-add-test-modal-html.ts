export type SigmaAddTestModalInput = { showSearch: boolean; searchValue: string; rowsHtml: string; emptyHtml: string; closeButtonHtml: string };

export function sigmaAddTestModalHtml(input: SigmaAddTestModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Chọn hoặc thêm xét nghiệm vào Six Sigma</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">${input.showSearch?`<input id="sgAddTestSearch" type="search" placeholder="Tìm tên xét nghiệm, máy hoặc đơn vị..." value="${input.searchValue}" oninput="sgAddTestSearchSet(this.value)">`:''}
      <div class="sg-add-test-list">${input.rowsHtml||input.emptyHtml}</div></div>
    <div class="modal-f">${input.closeButtonHtml}</div></div>`;
}
