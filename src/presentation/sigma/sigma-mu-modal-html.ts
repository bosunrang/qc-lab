export type SigmaMuModalInput = { sourceLabel: string; rowsHtml: string; modelNoteHtml: string; reviewedByValue: string; reviewedDateHtml: string; periodRowsHtml: string; selectAllButtonHtml: string; clearSelectionButtonHtml: string; cancelButtonHtml: string; applyButtonHtml: string };

export function sigmaMuModalHtml(input: SigmaMuModalInput) {
  return `<div class="modal sg-eqa-modal sg-mu-modal"><div class="modal-h"><h3>Ngân sách độ không đảm bảo đo (MU)</h3><button class="modal-close" onclick="closeModal()" aria-label="Đóng">✕</button></div>
    <div class="modal-b"><div class="sg-mu-intro"><div><b>Nhập thông tin theo từng mức QC</b></div><span class="tag none">Kỳ gốc: ${input.sourceLabel}</span></div>
      <div class="sg-eqa-table-wrap"><table class="sg-eqa-table sg-mu-table"><thead><tr><th>Mức QC</th><th>u(cal) từ CoA</th><th>Nguồn / mã CoA</th><th>Xử lý u(bias)</th><th>MU dự kiến</th></tr></thead><tbody>${input.rowsHtml}</tbody></table></div>
      <div class="alert info" style="display:block">${input.modelNoteHtml}</div>
      <div class="sg-mu-section-title"><b>Thông tin rà soát</b></div>
      <div class="sg-setup-fields"><div><label for="sgMuBy">Người rà soát</label><input id="sgMuBy" value="${input.reviewedByValue}" placeholder="Họ tên người rà soát ngân sách MU"></div><div><label for="sgMuDate">Ngày rà soát</label>${input.reviewedDateHtml}</div></div>
      <div class="sg-eqa-period-wrap sg-mu-period-wrap"><div class="sg-eqa-period-head"><div><b>Kỳ áp dụng</b></div><div>${input.selectAllButtonHtml}${input.clearSelectionButtonHtml}</div></div><div class="sg-eqa-period-list">${input.periodRowsHtml}</div></div></div>
    <div class="modal-f">${input.cancelButtonHtml}${input.applyButtonHtml}</div></div>`;
}
