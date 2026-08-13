type EntryPointsPanelInput = {
  open: boolean;
  startText: string;
  endText: string;
  tableCardsHtml: string;
  voidedHtml: string;
};

type EntryPointsPanelDependencies = { escape: (value: unknown) => string };

export function createEntryPointsPanelHtml(deps: EntryPointsPanelDependencies) {
  return (input: EntryPointsPanelInput) => `<details class="panel entry-secondary-panel qc-points-panel" ${input.open ? 'open' : ''} ontoggle="entryDetailToggled('points',this.open)"><summary class="entry-secondary-summary"><span>Điểm trong khoảng xem</span><small>Tra cứu chi tiết, luật vi phạm và điểm đã hủy</small></summary><div class="entry-secondary-body">
    <div class="hint qc-cumulative-note">Thống kê tích lũy tính từ đầu LOT đến ${deps.escape(input.endText)}; bảng bên dưới hiển thị từ ${deps.escape(input.startText)} đến ${deps.escape(input.endText)}.</div>
    <div class="qc-table-grid">${input.tableCardsHtml}</div>${input.voidedHtml}</div></details>`;
}
