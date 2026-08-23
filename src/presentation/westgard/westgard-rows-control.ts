export function createWestgardRowsControl(deps: {
  button: (label: string, action: string | { action: string; args?: unknown[] } | null, variant: string) => string;
  quote: (value: unknown) => string;
}) {
  return (view: { total: number; rows: unknown[]; visibleCount: number }, key: unknown, initialRows: number, step = initialRows) => {
    if (view.total <= initialRows) return '';
    const hasMore = view.visibleCount < view.total;
    const next = hasMore ? Math.min(view.visibleCount + step, view.total) : initialRows;
    const label = hasMore ? `Tải thêm ${next - view.visibleCount} điểm` : `Thu gọn còn ${initialRows} điểm`;
    const suffix = hasMore ? ' mới nhất' : '';
    return `<div class="wg-row-window"><span>Đang hiển thị ${view.rows.length}/${view.total} điểm${suffix}</span>${deps.button(label, { action: 'wgLoadMoreRows', args: [key, next] }, 'ghost sm')}</div>`;
  };
}
