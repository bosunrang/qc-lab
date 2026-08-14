export type SigmaFrequencyPanelInput = { periodLabel: string; rowsHtml: string; governingBlockHtml: string };

export function sigmaFrequencyPanelHtml(input: SigmaFrequencyPanelInput) {
  return `<div class="hint sg-selected-period-hint">Kỳ đang xem: <b>${input.periodLabel}</b></div><table><thead><tr><th>Mức</th><th class="num">Sigma</th><th>Bộ quy tắc QC gợi ý (OPSpecs)</th><th>Mức nguy cơ tham khảo</th><th>Hành động</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>${input.governingBlockHtml}
    <div class="alert alert-block info flow-item">Gợi ý theo <b>Westgard Sigma Rules</b> chỉ là điểm khởi đầu. Phần mềm <b>không tự đổi</b> bộ quy tắc của xét nghiệm — người phụ trách rà soát rồi tự cấu hình trong Cài đặt Westgard theo đánh giá nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng.</div>`;
}
