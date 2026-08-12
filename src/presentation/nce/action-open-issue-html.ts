export type ActionOpenIssueModel = {
  severity: 'rej' | 'warn';
  title: string;
  context: string;
  date: string;
  verdict?: string;
  rule: string;
  errorType: string;
  workflowClass: string;
  workflowLabel: string;
  sideChips: string;
  primary: string;
  owner: string;
  dueDate?: string;
  editable: boolean;
  index: number;
};

export function createActionOpenIssueHtml(deps: { escape: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (model: ActionOpenIssueModel) => `<div class="issue-row ${model.severity}"><div class="issue-row-main"><b>${deps.escape(model.title)} · ${deps.escape(model.context)}</b><div class="meta">${model.date}${model.verdict ? ' · ' + deps.escape(model.verdict) : ''} · ${deps.escape(model.rule)} · ${deps.escape(model.errorType)}</div><div class="action-chipline"><span class="action-chip ${model.workflowClass}">${deps.escape(model.workflowLabel)}</span>${model.sideChips}</div><div class="hint">${deps.escape(model.primary)} · Phụ trách: ${deps.escape(model.owner || '—')}${model.dueDate ? ' · hạn ' + model.dueDate : ''}</div></div>${model.editable ? deps.button('Tiếp tục hồ sơ', `editAction(${model.index})`, 'ghost sm') : ''}</div>`;
}
