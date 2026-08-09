type BiasInfo = Record<string, any>;

export function createActionBiasPresentation(formatNumber: (value: number) => string) {
  function thresholdHtml(info: BiasInfo) {
    if (!info.tea) return 'Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung, hoặc để trống nếu không áp dụng.';
    if (info.biasAfter == null) return `Ngưỡng cho phép: ≤ ${formatNumber(info.threshold)}% (TEa/4). Nhập "Bias sau khắc phục" để so sánh.`;
    return `${info.withinThreshold ? '✔ Đạt' : '✘ Vượt'} ngưỡng: |Bias sau khắc phục| ${formatNumber(Math.abs(info.biasAfter))}% so với ${formatNumber(info.threshold)}%.`;
  }
  function referenceHtml(info: BiasInfo) {
    if (!info.crit) return info.tea ? 'Nhập "Bias trước khắc phục" ở mục 4-6 để tính số tham khảo ΔSEcrit/ΔREcrit (mức độ sai số lúc sự cố xảy ra).' : 'Chưa đủ TEa%/SD để tính số tham khảo ΔSEcrit/ΔREcrit.';
    return `Độ lệch quan sát lúc sự cố ${formatNumber(info.degObs)} lần SD so với ΔSEcrit ${formatNumber(info.crit.dSEcrit)} · ΔREcrit ${formatNumber(info.crit.dREcrit)}. <b>Tham khảo — không phải kết luận chính thức của hồ sơ.</b>`;
  }
  return Object.freeze({ thresholdHtml, referenceHtml });
}

export type ActionBiasPresentation = ReturnType<typeof createActionBiasPresentation>;
