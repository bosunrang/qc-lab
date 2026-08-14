export function sigmaChartsPanelHtml() {
  return `<div class="panel"><h2 class="panel-title">Biểu đồ Sigma & MDC</h2><div class="sg-chart-grid"><div class="sg-chart-box"><h3>Xu hướng Sigma theo kỳ</h3><div class="chart-inner" id="sgTrend"></div></div><div class="sg-chart-box"><h3>Biểu đồ Quyết định Phương pháp (MDC)</h3><div class="hint">X = CV/TEA, Y = |BIAS|/TEA. Điểm to nhất là kỳ gần nhất.</div><div class="chart-inner" id="sgMDC"></div></div></div></div>`;
}
