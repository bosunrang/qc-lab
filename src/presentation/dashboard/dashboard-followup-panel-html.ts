export function dashboardFollowupPanelHtml(urgent: string, overdue: string, missingTarget: string, watch: string) {
  const content = `${urgent}${overdue}${missingTarget}${watch}`;
  return content ? `<div class="dash-list">${content}</div>` : '<div class="alert ok">Không có điểm bị loại/cảnh báo cần xử lý ngay.</div>';
}
