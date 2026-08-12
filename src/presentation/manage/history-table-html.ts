export function historyTableHtml(rowsHtml: string, emptyHtml: string) {
  return `<div class="rcfg-list">${rowsHtml ? `<table class="history-table"><thead><tr><th>Mức</th><th>Lô QC / Nhóm lô</th><th class="num">Mean</th><th class="num">Giới hạn dưới</th><th class="num">Giới hạn trên</th><th class="num">SD</th><th>Hiệu lực</th><th>Nguồn</th><th class="num">Điểm QC</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>` : emptyHtml}</div>`;
}
