export function reagentChartsPanelHtml(): string {
  return `<div class="panel rc-chart-panel"><h2 class="panel-title">Biểu đồ</h2><div class="rc-charts">
     <div class="rc-chart-box"><h3>Biểu đồ tương quan</h3><p>Lô cũ (trục X) so với Lô mới (trục Y)</p><div id="rcScatter"></div><div class="rc-chart-legend"><span><i class="reg"></i>Đường hồi quy</span><span><i class="ideal"></i>Đường lý tưởng y = x</span></div></div>
     <div class="rc-chart-box"><h3>Biểu đồ Bland-Altman</h3><p>Hiệu số (cũ − mới) so với giá trị trung bình</p><div id="rcBland"></div><div class="rc-chart-legend"><span><i class="bias"></i>Bias trung bình</span><span><i class="limit"></i>±1.96 SD</span></div></div></div></div>`;
}
