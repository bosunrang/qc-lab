export function createWestgardExportActionsHtml(deps: {
  button: (label: string, action: string, variant: string, title: string) => string;
  downloadIcon: () => string;
  printIcon: () => string;
}) {
  return (chartMode: string) => chartMode === 'lj'
    ? `<div><label>&nbsp;</label><div class="wg-export-actions">${deps.button(deps.downloadIcon() + 'Xuất Excel', 'exportWestgardXLSX()', 'teal wg-excel-btn', 'Xuất Excel biểu đồ Levey-Jennings, các vi phạm và điểm bằng chứng đang xem')}${deps.button(deps.printIcon() + 'In PDF', 'printWestgard()', 'teal wg-print-btn', 'Tạo bản in PDF/HTML biểu đồ Levey-Jennings và các vi phạm đang xem')}</div></div>`
    : '';
}
