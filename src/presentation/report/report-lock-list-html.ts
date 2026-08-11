export function createReportLockListHtml<L extends Record<string, any>>(deps: {
  sorted: (locks: L[]) => L[];
  month: (ym: unknown) => string;
  dateTime: (value: unknown) => string;
  escape: (value: unknown) => string;
  button: (label: string, action: string, variant: string) => string;
  quote: (value: unknown) => string;
}) {
  return (locks: L[], isAdmin: boolean) => {
    const rows = deps.sorted(locks || []);
    if (!rows.length) return '<div class="hint">Chưa có kỳ nào được khóa.</div>';
    return `<div class="period-lock-list">${rows.map(lock => {
      const by = deps.escape(lock.lockedBy || '—');
      const at = lock.lockedAt ? ` lúc ${deps.dateTime(lock.lockedAt)}` : '';
      const action = isAdmin ? deps.button('Mở khóa', `reportUnlockPeriod('${deps.quote(lock.ym)}')`, 'ghost sm') : '';
      return `<div class="period-lock-row"><div><b>Kỳ ${deps.escape(deps.month(lock.ym))}</b><span class="hint"> · Khóa bởi ${by}${at}</span></div>${action}</div>`;
    }).join('')}</div>`;
  };
}
