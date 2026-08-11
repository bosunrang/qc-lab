export function createWestgardPointRowsHtml<T>(deps: {
  verdictLabel: (level: unknown) => string;
  errorParts: (rules: string[]) => { type: string; desc?: string } | null;
  escape: (value: unknown) => string;
  date: (value: unknown) => string;
  testValue: (test: T, value: unknown) => string;
  format: (value: number) => string;
  referenceIcon: () => string;
}) {
  return (rows: Array<Record<string, any>>, test: T) => rows.map(row => {
    const verdict = deps.verdictLabel(row.level);
    const error = row.rules.length ? deps.errorParts(row.rules) : null;
    const errorHtml = error ? `<div class="wg-error-type"><b>${deps.escape(error.type)}</b>${error.desc ? `<small>${deps.escape(error.desc)}</small>` : ''}</div>` : '—';
    const support = (row.supportRules || []).map((rule: string) => `<span class="pill" title="Điểm lịch sử cấu thành quy tắc, không bị loại hồi tố">${deps.referenceIcon()} ${rule}</span>`).join('');
    const z = Number.isFinite(row.z) ? `${row.z >= 0 ? '+' : ''}${deps.format(row.z)}s` : '—';
    const rules = row.rules.map((rule: string) => `<span class="pill">${rule}</span>`).join('') || support || '—';
    const evidence = row.rules.length && support ? `<div class="hint flow-tight">Bằng chứng: ${support}</div>` : '';
    return `<tr><td>${row.index}</td><td>${deps.date(row.date)}</td><td class="num">${deps.testValue(test, row.value)}</td><td class="num">${z}</td><td><span class="tag ${row.level}">${verdict}</span></td><td>${rules}${evidence}</td><td class="hint">${errorHtml}</td></tr>`;
  }).join('');
}
