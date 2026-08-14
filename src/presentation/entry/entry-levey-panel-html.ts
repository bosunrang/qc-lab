type EntryLeveyPanelInput = { startDateHtml: string; endDateHtml: string; dayButtonsHtml: string; rangeText: string; stackHtml: string };

export function entryLeveyPanelHtml(input: EntryLeveyPanelInput) {
  return `<div class="panel"><div class="lj-toolbar"><h2 class="panel-title">Biểu đồ Levey-Jennings</h2><div class="lj-filter"><label class="lj-date-field"><span class="hint">Từ ngày</span>${input.startDateHtml}</label><label class="lj-date-field"><span class="hint">Đến ngày</span>${input.endDateHtml}</label><div class="dayseg">${input.dayButtonsHtml}</div></div></div><div class="hint lj-range">Khoảng xem: ${input.rangeText}</div><div class="lj-stack">${input.stackHtml}</div><div class="legend"><span><span class="dot" style="background:#0e8f8f"></span> Trong ±2SD</span><span><span class="dot" style="background:#dd8b1f"></span> Cảnh báo 2–3SD</span><span><span class="dot" style="background:#c5221f"></span> Loại bỏ ngoài 3SD</span></div></div>`;
}
