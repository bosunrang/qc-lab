type EntryChartPanelInput = {
  startDateInputHtml: string;
  endDateInputHtml: string;
  rangeButtonsHtml: string;
  startText: string;
  endText: string;
  levelCount: number;
  chartStackHtml: string;
};

type EntryChartPanelDependencies = { escape: (value: unknown) => string };

export function createEntryChartPanelHtml(deps: EntryChartPanelDependencies) {
  return (input: EntryChartPanelInput) => `<div class="panel"><div class="lj-toolbar">
        <h2 class="panel-title">Biểu đồ Levey-Jennings</h2>
        <div class="lj-filter"><label class="lj-date-field"><span class="hint">Từ ngày</span>${input.startDateInputHtml}</label><label class="lj-date-field"><span class="hint">Đến ngày</span>${input.endDateInputHtml}</label><div class="dayseg">${input.rangeButtonsHtml}</div></div></div>
      <div class="hint lj-range">Khoảng xem: ${deps.escape(input.startText)} – ${deps.escape(input.endText)} · ${input.levelCount} mức QC</div>
      <div class="lj-stack">${input.chartStackHtml}</div>
      <div class="legend"><span><span class="dot" style="background:#0e8f8f"></span> Trong ±2SD</span><span><span class="dot" style="background:#dd8b1f"></span> Cảnh báo 2–3SD</span><span><span class="dot" style="background:#c5221f"></span> Loại bỏ ngoài 3SD</span></div></div>`;
}
