type ManagePanelTableInput = { rowsHtml: string; emptyHtml: string };

export function managePanelTableHtml(input: ManagePanelTableInput) {
  const content = input.rowsHtml ? `<table class="panel-qc-table"><thead><tr><th>Tên panel</th><th>Máy xét nghiệm</th><th>Xét nghiệm trong panel</th><th class="num">Số vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>` : input.emptyHtml;
  return `<div class="panel rcfg-list">${content}</div>`;
}
