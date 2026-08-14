type ReagentReportDetailCardInput = { index: number; reagentHtml: string; pillHtml: string; bodyHtml: string; pagebreak: boolean };

export function reagentReportDetailCardHtml(input: ReagentReportDetailCardInput): string {
  return `<div class="rpt-card" style="${input.pagebreak ? 'break-before:page;' : ''}"><h3>${input.index}. ${input.reagentHtml} ${input.pillHtml}</h3><div class="body">${input.bodyHtml}</div></div>`;
}

export function reagentReportChartGridHtml(scatterHtml: string, blandHtml: string): string {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${scatterHtml}${blandHtml}</div>`;
}
