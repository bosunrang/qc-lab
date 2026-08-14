export type TargetSwitchModalInput = {
  groupName: string;
  overwriteCount: number;
  assayNames: string;
  lockNote: string;
  cancelButtonHtml: string;
  plannedButtonHtml: string;
  switchButtonHtml: string;
};

export function targetSwitchModalHtml(input: TargetSwitchModalInput) {
  return `<div class="modal">
    <div class="modal-h"><h3>Áp dụng nhóm lô ${input.groupName}?</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="hint">${input.overwriteCount} dòng (${input.assayNames}) hiện đang dùng một nhóm lô khác. Chọn cách áp dụng Mean/SD vừa nhập:</div>
      <div class="hint flow-control"><b>Chuyển qua nhóm lô này</b>: áp dụng ngay cho các dòng trên, nhóm lô đang dùng trước đó sẽ được đánh dấu "Đã dừng" (vẫn xem/nhập được nếu cần, không bị khóa).${input.lockNote}</div>
      <div class="hint flow-note"><b>Dự kiến</b>: chỉ lưu lại Mean/SD đã nhập cho nhóm lô mới, chưa áp dụng — nhóm lô đang dùng vẫn tiếp tục như bình thường.</div>
    </div>
    <div class="modal-f">${input.cancelButtonHtml}${input.plannedButtonHtml}${input.switchButtonHtml}</div>
  </div>`;
}
