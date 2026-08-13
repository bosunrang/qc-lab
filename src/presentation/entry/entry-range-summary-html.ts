type EntryRangeSummaryInput = {
  open: boolean;
  summary: string;
  source: string;
  mean: string;
  sd: string;
  eligible: boolean;
  candidateCount: number;
  candidateDays: number;
  candidateMean: string;
  candidateSd: string;
  candidateCv: string;
  actionsHtml: string;
};

type EntryRangeSummaryDependencies = { escape: (value: unknown) => string };

export function createEntryRangeSummaryHtml(deps: EntryRangeSummaryDependencies) {
  return (input: EntryRangeSummaryInput) => `<details class="panel entry-secondary-panel range-summary-panel" ${input.open ? 'open' : ''} ontoggle="entryDetailToggled('range',this.open)"><summary class="entry-secondary-summary"><span>Thống kê toàn bộ &amp; Dải kiểm soát</span><small>${deps.escape(input.summary)}</small></summary>
     <div class="entry-secondary-body"><div class="range-band-note"><div class="range-band-label">Dải đang dùng:</div><div class="range-band-source">${deps.escape(input.source)}</div><div class="range-band-body">· Mean=${deps.escape(input.mean)} SD=${deps.escape(input.sd)}.
       ${input.eligible ? ` Đủ điều kiện lập dải mới (${input.candidateCount} kết quả / ${input.candidateDays} ngày độc lập). Dải đề xuất: Mean=${deps.escape(input.candidateMean)} SD=${deps.escape(input.candidateSd)} CV=${deps.escape(input.candidateCv)}%.` : ` Cần ≥20 kết quả trên ≥20 ngày độc lập, không có điểm vi phạm/cảnh báo chưa xử lý — hiện ${input.candidateCount} kết quả / ${input.candidateDays} ngày.`}</div></div>
     ${input.actionsHtml}</div></details>`;
}
