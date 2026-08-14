type EntryPointsPanelInput = { open: boolean; endDateText: string; startDateText: string; tableCardsHtml: string; voidedBoxHtml: string };

export function entryPointsPanelHtml(input: EntryPointsPanelInput) {
  return `<details class="panel entry-secondary-panel qc-points-panel" ${input.open ? 'open' : ''} ontoggle="entryDetailToggled('points',this.open)"><summary class="entry-secondary-summary"><span>Điểm trong khoảng xem</span><small>Tra cứu chi tiết, luật vi phạm và điểm đã hủy</small></summary><div class="entry-secondary-body"><div class="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT đến ${input.endDateText}; bảng bên dưới hiển thị từ ${input.startDateText} đến ${input.endDateText}.</div><div class="qc-table-grid">${input.tableCardsHtml}</div>${input.voidedBoxHtml}</div></details>`;
}
