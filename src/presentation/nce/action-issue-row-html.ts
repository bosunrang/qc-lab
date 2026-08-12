type IssueAction = { kind: 'continue'; index: number } | { kind: 'create'; testId: string; level: number; rules: string; error: string; hint: string; pointId: string; date: string };

export type ActionIssueRowModel = {
  severity: string;
  level: string;
  state: string;
  value: string;
  unit: string;
  rules: string;
  error: string;
  workflowClass: string;
  workflowLabel: string;
  sideChips: string;
  footer: string;
  action?: IssueAction;
};

export function createActionIssueRowHtml(deps: { escape: (value: unknown) => string; button: (label: string, action: string, variant: string) => string; quote: (value: unknown) => string }) {
  return (model: ActionIssueRowModel) => {
    const action = !model.action ? '' : model.action.kind === 'continue'
      ? deps.button('Tiếp tục hồ sơ', `editAction(${model.action.index})`, 'ghost sm')
      : deps.button('Lập hồ sơ', `beginActionFromIssue('${deps.quote(model.action.testId)}',${model.action.level},'${deps.quote(model.action.rules)}','${deps.quote(model.action.error)}','${deps.quote(model.action.hint)}','${deps.quote(model.action.pointId)}','${deps.quote(model.action.date)}')`, 'ghost sm');
    return `<div class="issue-row ${model.severity}"><div class="issue-row-main"><b>${deps.escape(model.level)} · ${deps.escape(model.state)}</b><div class="meta">${model.value} ${deps.escape(model.unit || '')} · ${model.rules || '—'} · ${model.error}</div><div class="action-chipline"><span class="action-chip ${model.workflowClass}">${deps.escape(model.workflowLabel)}</span>${model.sideChips}</div><div class="hint">${model.footer}</div></div>${action}</div>`;
  };
}
