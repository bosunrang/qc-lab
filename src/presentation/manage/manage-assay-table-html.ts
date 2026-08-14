type ManageAssayTableInput = { rowsHtml: string; emptyHtml: string };

export function manageAssayTableHtml(input: ManageAssayTableInput) {
  const content = input.rowsHtml ? `<table class="assay-table"><thead><tr><th class="num">STT</th><th>Tên xét nghiệm</th><th>Máy xét nghiệm</th><th>Hóa chất</th><th>TEa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>` : input.emptyHtml;
  return `<div class="panel rcfg-list">${content}</div>`;
}
