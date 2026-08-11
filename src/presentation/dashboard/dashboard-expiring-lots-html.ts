type ExpiringLot = { l: { lot?: string; level: unknown }; d: number; count: number };

export function createDashboardExpiringLotsHtml(deps: { escape: (value: unknown) => string }) {
  return (lots: Iterable<ExpiringLot>) => {
    const rows = [...lots].sort((a, b) => a.d - b.d).slice(0, 5).map(item => {
      const expired = item.d < 0;
      const state = expired ? 'rej' : 'warn';
      const meta = item.count > 1 ? `${item.count} xét nghiệm · ` : '';
      const remaining = expired ? `Hết hạn ${-item.d} ngày` : `Còn ${item.d} ngày`;
      return `<div class="shift-item ${state}"><div><b>Lô ${deps.escape(item.l.lot || '?')} · M${item.l.level}</b><div class="meta">${meta}${remaining}</div></div><span class="tag ${state}">${expired ? 'Hết hạn' : 'Sắp hết'}</span></div>`;
    }).join('');
    return rows || '<div class="hint">Không có lô sắp hết hạn trong 30 ngày.</div>';
  };
}
