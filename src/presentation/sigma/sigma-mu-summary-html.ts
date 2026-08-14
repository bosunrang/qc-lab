export type SigmaMuSummaryInput = { periodLabel: string; cellsHtml: string; traceHtml: string; excludedNoteHtml: string };

export function sigmaMuSummaryHtml(input: SigmaMuSummaryInput) {
  return `<div class="hint sg-selected-period-hint">Kỳ đang xem: <b>${input.periodLabel}</b></div>
    <div class="sg-mu-table-wrap"><table class="sg-mu-summary-table"><colgroup><col><col><col><col><col><col><col><col><col></colgroup><thead><tr><th>Mức</th><th class="num">u(Rw) %</th><th class="num">u(bias) %</th><th class="num">u(cal) %</th><th class="num">u<sub>c</sub> %</th><th class="num">U (k=2) %</th><th class="num">U tại Mean</th><th class="num">U / TEa</th><th>Trạng thái</th></tr></thead><tbody>${input.cellsHtml}</tbody></table></div>
    ${input.traceHtml}${input.excludedNoteHtml}
    <div class="alert alert-block info flow-item">Giới hạn MU cho phép (MAU) <b>phải do SOP của đơn vị ấn định</b> — phần mềm chỉ đặt U cạnh TEa để so sánh, không tự kết luận đạt/không đạt. Ngân sách còn thiếu thành phần thì <b>không được công bố</b> như một giá trị MU hoàn chỉnh.</div>`;
}
