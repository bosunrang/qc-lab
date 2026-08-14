export type RangeWorkflowModalInput = { contextHtml: string; nceNoticeHtml: string; checklistRowsHtml: string; currentRangeRowHtml: string; proposedRangeRowHtml: string; printButtonHtml: string; applyButtonHtml: string; closeButtonHtml: string };

export function rangeWorkflowModalHtml(input: RangeWorkflowModalInput) {
  return `<div class="modal range-workflow-modal"><div class="modal-h"><h3>Workflow thiết lập dải QC mới</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><div class="hint">${input.contextHtml}</div>${input.nceNoticeHtml}
      <table class="range-workflow-checklist"><colgroup><col><col><col><col></colgroup><thead><tr><th>Điều kiện</th><th>Hiện tại</th><th>Chuẩn kiểm tra</th><th>Kết quả</th></tr></thead><tbody>${input.checklistRowsHtml}</tbody></table>
      <h3 style="margin:16px 0 8px">So sánh dải kiểm soát</h3>
      <table class="range-workflow-comparison"><colgroup><col><col><col><col><col></colgroup><thead><tr><th>Dải</th><th>Mean</th><th>SD</th><th>CV%</th><th>±2SD</th></tr></thead><tbody>${input.currentRangeRowHtml}${input.proposedRangeRowHtml}</tbody></table>
      <div class="alert info flow-section">Mean/SD được tính từ toàn bộ tập dữ liệu đã chọn. Không tự loại điểm vi phạm để làm giảm SD. Chỉ áp dụng khi cùng lô QC, tối thiểu 20 ngày độc lập, quá trình ổn định và có phê duyệt theo SOP.</div></div>
    <div class="modal-f">${input.printButtonHtml}${input.applyButtonHtml}${input.closeButtonHtml}</div></div>`;
}
