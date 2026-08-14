type ReagentPairPanelInput = { oldLotHeadHtml: string; newLotHeadHtml: string; rowsHtml: string; actionsHtml: string; minPairs: number };

export function reagentPairPanelHtml(input: ReagentPairPanelInput): string {
  return `<div class="panel rc-pair-panel"><h2 class="panel-title">Dữ liệu đo bắt cặp</h2><div class="rc-pair-wrap"><div class="rc-pair-head"><div>Mẫu</div><div id="rcOldLotHead">${input.oldLotHeadHtml}</div><div id="rcNewLotHead">${input.newLotHeadHtml}</div><div>Trung bình</div><div>Hiệu số (cũ − mới)</div><div></div></div>${input.rowsHtml}</div>
     ${input.actionsHtml ? `<div class="rc-pair-actions">${input.actionsHtml}</div>` : ''}
     <div class="hint" style="margin:8px 16px 16px">Nhập tối thiểu ${input.minPairs} cặp để tính mô tả; để phần mềm đánh dấu “đạt sàng lọc” cần ≥20 cặp hợp lệ, bao phủ khoảng đo/điểm quyết định lâm sàng và %bias trong giới hạn SOP. Không dùng p-value để tự chấp nhận lô.</div></div>`;
}
