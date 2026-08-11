export type WestgardXlsxPoint = { date?: string; runId?: string; val?: number; [key: string]: unknown };
export type WestgardXlsxVerdict = { level?: string; rules?: string[]; supportRules?: string[]; [key: string]: unknown };
export type WestgardXlsxItem = { p: WestgardXlsxPoint; f: WestgardXlsxVerdict; z?: number };

export function createWestgardXlsxRows(deps: {
  date: (value: unknown) => string;
  staffCode: (point: WestgardXlsxPoint) => string;
  verdict: (level: unknown) => string;
  error: (rules: string[]) => string;
  number: (value: unknown) => string;
}) {
  const detail = (item: WestgardXlsxItem, index: number) => {
    const rules = [...new Set(item.f.rules || [])];
    const support = [...new Set(item.f.supportRules || [])].filter(rule => !rules.includes(rule));
    const evidence = !rules.length && support.length > 0;
    const used = rules.length ? rules : support;
    return {
      index, date: deps.date(item.p.date), runId: item.p.runId || '—', staffCode: deps.staffCode(item.p) || '—',
      value: Number.isFinite(item.p.val) ? item.p.val : '', z: (Number(item.z) >= 0 ? '+' : '') + deps.number(item.z) + 's',
      verdict: evidence ? 'Bằng chứng' : deps.verdict(item.f.level), style: item.f.level === 'rej' ? 'rej' : item.f.level === 'warn' ? 'warn' : 'ok',
      ruleText: rules.join(', ') || (evidence ? 'Bằng chứng: ' + support.join(', ') : '—'), error: used.length ? deps.error(used) : '—',
    };
  };
  return Object.freeze({ detail });
}

export type WestgardXlsxRows = ReturnType<typeof createWestgardXlsxRows>;
