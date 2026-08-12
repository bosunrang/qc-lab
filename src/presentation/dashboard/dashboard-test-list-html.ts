export function dashboardTestListHtml(visibleCount: number, rowsHtml: string) {
  if (!visibleCount) return '<div class="dash-test-empty">Không tìm thấy xét nghiệm phù hợp.</div>';
  return `<div class="dash-test-list"><table><thead><tr><th>Xét nghiệm</th><th>Mức QC / lô</th><th>QC hôm nay</th><th class="num">Tổng điểm</th><th>Westgard</th><th>Gần nhất</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${rowsHtml}</tbody></table></div><div id="dashTestEmpty" class="dash-test-empty" style="display:none">Không tìm thấy xét nghiệm phù hợp.</div>`;
}
