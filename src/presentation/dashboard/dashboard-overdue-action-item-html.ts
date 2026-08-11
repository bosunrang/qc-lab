type Action = Record<string, any>;

export function createDashboardOverdueActionItemHtml(deps: {
  escape: (value: unknown) => string;
  testLabel: (test: Record<string, any>) => string;
  date: (value: unknown) => string;
  button: (label: string, action: string, variant: string) => string;
}) {
  return (input: { action: Action; index: number; info: { label: string }; test?: Record<string, any> }) => {
    const title = input.test ? deps.escape(deps.testLabel(input.test)) : deps.escape(input.action.rule || 'Sự cố');
    return `<div class="shift-item rej"><div><b>${deps.escape(input.action.nceId || 'Hồ sơ khắc phục')} · ${title}</b><div class="meta">${deps.escape(input.info.label)} · hạn ${deps.date(input.action.dueDate)} · phụ trách ${deps.escape(input.action.by || '—')}</div></div>${deps.button('Tiếp tục hồ sơ', `go('actions');editAction(${input.index})`, 'ghost sm')}</div>`;
  };
}
