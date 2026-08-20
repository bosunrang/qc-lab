export type ActionCancelModalInput = { closeButtonHtml: string; cancelButtonHtml: string };

export function actionCancelModalHtml(input: ActionCancelModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Hủy hồ sơ NCE</h3><button class="modal-close" data-action="closeModal">✕</button></div><div class="modal-b">
      <div class="alert warn action-cancel-warning"><b>Hồ sơ sẽ không bị xóa.</b><div>Nội dung, người lập và toàn bộ bằng chứng vẫn được giữ để truy xuất. Nếu hồ sơ gắn với vi phạm QC, sự cố đó sẽ xuất hiện lại để lập hồ sơ mới.</div></div>
      <label>Lý do hủy (tối thiểu 5 ký tự)</label>
      <textarea id="actionCancelReason" placeholder="VD: Mở nhầm cho sai điểm QC; lập lại hồ sơ đúng đối tượng..." data-action="hideFieldError" data-args='["actionCancelErr"]' data-action-on="input"></textarea>
      <div id="actionCancelErr" class="hint field-error">Cần nhập lý do hủy tối thiểu 5 ký tự.</div>
    </div><div class="modal-f">${input.closeButtonHtml}${input.cancelButtonHtml}</div></div>`;
}
