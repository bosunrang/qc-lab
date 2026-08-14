type TeaReferenceTableInput = { rowsHtml: string; emptyHtml: string };

export function teaReferenceTableHtml(input: TeaReferenceTableInput) {
  const content = input.rowsHtml ? `<table class="tea-ref-table"><thead><tr><th>Xét nghiệm</th><th>Đơn vị</th><th>Nhóm</th><th>TEa CLIA %</th><th>TEa Ricos %</th><th>TEa chuẩn hóa %</th><th>Trạng thái</th></tr></thead><tbody>${input.rowsHtml}</tbody></table>` : input.emptyHtml;
  return `<div class="panel rcfg-list tea-ref-panel">${content}</div>`;
}
