type ManageInstrumentTableInput = { rowsHtml: string; emptyHtml: string };

export function manageInstrumentTableHtml(input: ManageInstrumentTableInput) {
  const content = input.rowsHtml ? `<table class="instrument-table"><thead><tr><th>Máy xét nghiệm</th><th>Nhà sản xuất</th><th>Số sê-ri</th><th class="num">Xét nghiệm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>` : input.emptyHtml;
  return `<div class="panel rcfg-list">${content}</div>`;
}
