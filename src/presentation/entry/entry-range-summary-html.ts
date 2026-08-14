type EntryRangeSummaryInput = { open: boolean; summary: string; source: string; mean: string; sd: string; eligible: boolean; resultCount: number; dayCount: number; proposedMean: string; proposedSd: string; proposedCv: string; actionsHtml: string };

export function entryRangeSummaryHtml(input: EntryRangeSummaryInput) {
  const detail = input.eligible
    ? ` Đủ điều kiện lập dải mới (${input.resultCount} kết quả / ${input.dayCount} ngày độc lập). Dải đề xuất: Mean=${input.proposedMean} SD=${input.proposedSd} CV=${input.proposedCv}%.`
    : ` Cần ≥20 kết quả trên ≥20 ngày độc lập, không có điểm vi phạm/cảnh báo chưa xử lý — hiện ${input.resultCount} kết quả / ${input.dayCount} ngày.`;
  return `<details class="panel entry-secondary-panel range-summary-panel" ${input.open ? 'open' : ''} ontoggle="entryDetailToggled('range',this.open)"><summary class="entry-secondary-summary"><span>Thống kê toàn bộ &amp; Dải kiểm soát</span><small>${input.summary}</small></summary><div class="entry-secondary-body"><div class="range-band-note"><div class="range-band-label">Dải đang dùng:</div><div class="range-band-source">${input.source}</div><div class="range-band-body">· Mean=${input.mean} SD=${input.sd}.${detail}</div></div>${input.actionsHtml}</div></details>`;
}
