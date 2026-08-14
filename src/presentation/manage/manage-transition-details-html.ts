type ManageTransitionDetailsInput = { movedLotNo: string; approvalText: string };

export function manageTransitionDetailsHtml(input: ManageTransitionDetailsInput) {
  return { movedHtml: input.movedLotNo ? `<div class="hint">Đã chuyển tiếp qua lô ${input.movedLotNo}</div>` : '', approvalHtml: input.approvalText ? `<div class="hint">Duyệt: ${input.approvalText}</div>` : '' };
}
