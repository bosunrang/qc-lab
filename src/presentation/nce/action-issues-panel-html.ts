export function actionIssuesPanelHtml(issuesHtml: string) {
  return `<div class="panel action-issues-panel"><h2 class="panel-title">Sự cố cần xử lý</h2><div class="dash-list">${issuesHtml}</div></div>`;
}
