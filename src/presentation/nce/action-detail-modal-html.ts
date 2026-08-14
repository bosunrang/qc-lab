export type ActionDetailModalInput = { bodyHtml: string; closeButtonHtml: string };

export function actionDetailModalHtml(input: ActionDetailModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Chi tiết phiếu xử lý sự cố</h3><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">${input.bodyHtml}</div><div class="modal-f">${input.closeButtonHtml}</div></div>`;
}
