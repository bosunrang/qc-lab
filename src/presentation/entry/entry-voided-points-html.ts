export function entryVoidedPointsHtml(rowsHtml: string) {
  if (!rowsHtml) return '';
  return `<div class="qc-voided-box"><h4>Điểm đã hủy trong khoảng</h4><table class="qc-voided-table"><thead><tr><th>Ngày</th><th>Mức / lô</th><th class="num">Giá trị</th><th>Lần chạy</th><th>Người hủy</th><th>Lý do</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}
