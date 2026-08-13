type EntryWorksheetInput = {
  testName: string;
  lotLabel: string;
  monthOptionsHtml: string;
  yearOptionsHtml: string;
  levelHeadHtml: string;
  rowsHtml: string;
  columnCount: number;
  messageHtml: string;
  navigationButtonsHtml: string;
  emptyRowHtml: string;
};

type EntryWorksheetDependencies = {
  escape: (value: unknown) => string;
  button: (label: string, action: string, variant: string, title?: string) => string;
};

export function createEntryWorksheetHtml(deps: EntryWorksheetDependencies) {
  return (input: EntryWorksheetInput) => `<div class="panel qc-sheet-panel"><div class="qc-sheet-heading">
      <div class="qc-sheet-title"><span>Bảng nhập QC</span><strong>${deps.escape(input.testName)}</strong><small>Lô ${deps.escape(input.lotLabel)}</small></div>
      <div class="qc-month-area"><div class="qc-month-picker"><select aria-label="Chọn tháng" onchange="entrySetSheetPart('month',this.value)">${input.monthOptionsHtml}</select><select aria-label="Chọn năm" onchange="entrySetSheetPart('year',this.value)">${input.yearOptionsHtml}</select>${input.navigationButtonsHtml}</div></div></div>
      <div class="qc-sheet-wrap" role="region" aria-label="Bảng nhập QC theo tháng" tabindex="0"><table class="qc-sheet"><thead><tr><th>Ngày</th>${input.levelHeadHtml}<th>NV thực hiện</th><th>Vi phạm cảnh báo</th><th>Vi phạm loại bỏ</th><th>Chấp nhận</th><th>Ghi chú</th></tr></thead>
       <tbody>${input.rowsHtml || input.emptyRowHtml}</tbody></table></div>
      <div id="entryMsg" role="status" aria-live="polite" style="margin:12px 16px 16px">${input.messageHtml}</div></div>`;
}
