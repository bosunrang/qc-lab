type Action = Record<string, any>;

export type ActionStatusPresentationDeps = {
  checkLabels: Record<string, string>;
};

export function createActionStatusPresentation(deps: ActionStatusPresentationDeps) {
  const detailCheck = (status: string) => ({
    cls: ['abnormal', 'checked-abnormal'].includes(status) ? 'rej' : ['ok', 'checked-ok'].includes(status) ? 'ok' : 'none',
    label: deps.checkLabels[status] || 'Chưa ghi',
  });
  const sideChips = (action: Action, stage: string, rerun: Record<string, any>, overdue: Record<string, any>, effectiveness: Record<string, any>) => {
    const chips: Array<{ cls: string; label: string }> = [];
    if (rerun.needed && stage !== 'rerun') chips.push({ cls: rerun.cls, label: rerun.label });
    if (overdue.overdue) chips.push({ cls: 'rej', label: overdue.label });
    if (effectiveness.escalated) chips.push({ cls: 'warn', label: `Đã chuyển ${action.followUpNceId}` });
    if (action.parentNceId) chips.push({ cls: 'none', label: `Nối tiếp ${action.parentNceId}` });
    return chips;
  };
  return Object.freeze({ detailCheck, sideChips });
}

export type ActionStatusPresentation = ReturnType<typeof createActionStatusPresentation>;
