export type ActionReopenModalInput = { workflowLabelHtml: string; closeButtonHtml: string; reopenButtonHtml: string };

export function actionReopenModalHtml(input: ActionReopenModalInput) {
  return `<div class="modal"><div class="modal-h"><h3>Mở lại hồ sơ đã duyệt</h3><button class="modal-close" data-action="closeModal">✕</button></div><div class="modal-b">
      <div class="alert warn">Hồ sơ đã duyệt nhưng điều kiện khép vòng không còn đúng: ${input.workflowLabelHtml}.</div>
      <label>Lý do mở lại (tối thiểu 5 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="VD: Điểm QC dùng làm bằng chứng chạy lại đã bị hủy..." data-action="hideFieldError" data-args='["actionNoteErr"]' data-action-on="input"></textarea>
      <div id="actionNoteErr" class="hint field-error">Cần nhập lý do tối thiểu 5 ký tự.</div>
    </div><div class="modal-f">${input.closeButtonHtml}${input.reopenButtonHtml}</div></div>`;
}
