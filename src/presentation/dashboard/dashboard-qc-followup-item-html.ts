type AlertItem = { t: Record<string, any>; l: { level: unknown }; p: { date: unknown }; rules: string[] };

export function createDashboardQcFollowupItemHtml(deps: {
  escape: (value: unknown) => string;
  testLabel: (test: Record<string, any>) => string;
  date: (value: unknown) => string;
  pointValue: (point: unknown, test: Record<string, any>) => string;
  button: (label: string, action: string, variant: string) => string;
  quote: (value: unknown) => string;
}) {
  return (item: AlertItem, status: string) => `<div class="shift-item ${status}"><div><b>${deps.escape(deps.testLabel(item.t))} · M${item.l.level}</b><div class="meta">${deps.date(item.p.date)} · ${deps.pointValue(item.p, item.t)} ${deps.escape(item.t.unit || '')} · ${item.rules.join(', ') || '—'}</div></div>${deps.button('Xem', `entrySel={testId:'${deps.quote(item.t.id)}',level:${item.l.level}};entryStart=null;entryEnd=null;go('entry')`, 'ghost sm')}</div>`;
}
