export type ActionIssueGroupModel = { severity: string; title: string; date: string; count: number; countLabel: string; itemsHtml: string };

export function createActionIssueGroupHtml(deps: { escape: (value: unknown) => string }) {
  return (model: ActionIssueGroupModel) => `<div class="issue-group ${model.severity}"><div class="issue-group-h"><div><b>${deps.escape(model.title)}</b><span class="issue-group-date">${deps.escape(model.date)}</span></div><span class="issue-group-count">${model.count} ${deps.escape(model.countLabel)}</span></div><div class="issue-group-body">${model.itemsHtml}</div></div>`;
}
