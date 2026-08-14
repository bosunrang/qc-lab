export type SigmaPeriodTableInput = { headerActionsHtml: string; hasData: boolean; tableMinWidth: number; colGroupHtml: string; tableHeadHtml: string; rowsHtml: string; combinedExportHtml: string };

export function sigmaPeriodTableHtml(input: SigmaPeriodTableInput) {
  const content=input.hasData?`<div class="sg-simple-table-wrap"><table class="sg-simple-table" style="min-width:${input.tableMinWidth}px">${input.colGroupHtml}${input.tableHeadHtml}<tbody>${input.rowsHtml}</tbody></table></div>`:'<div class="empty" style="margin:14px 16px 10px">Chưa có kỳ nào.</div>';
  return `<div class="panel"><div class="sg-data-head"><h2 class="panel-title">Số liệu theo kỳ</h2><div class="sg-data-head-actions">${input.headerActionsHtml}</div></div>${content}${input.combinedExportHtml?`<div class="sg-data-foot">${input.combinedExportHtml}</div>`:''}</div>`;
}
