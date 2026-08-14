type ManageTransitionTableInput = { rowsHtml: string; emptyHtml: string };

export function manageTransitionTableHtml(input: ManageTransitionTableInput) {
  const content = input.rowsHtml ? `<table class="transition-table"><thead><tr><th>Panel QC</th><th>Chuyển lô</th><th>Bắt đầu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>` : input.emptyHtml;
  return `<div class="panel rcfg-list transition-list">${content}</div>`;
}
