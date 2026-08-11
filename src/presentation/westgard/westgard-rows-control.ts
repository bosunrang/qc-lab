export function createWestgardRowsControl(deps: {
  button: (label: string, action: string, variant: string) => string;
  quote: (value: unknown) => string;
}) {
  return (view: { total: number; rows: unknown[]; expanded: boolean }, key: unknown, initialRows: number) => {
    if (view.total <= initialRows) return '';
    const label = view.expanded ? `Thu gọn còn ${initialRows} điểm` : `Xem toàn bộ ${view.total} điểm`;
    const suffix = view.expanded ? '' : ' mới nhất';
    return `<div class="wg-row-window"><span>Đang hiển thị ${view.rows.length}/${view.total} điểm${suffix}</span>${deps.button(label, `wgToggleRows('${deps.quote(key)}')`, 'ghost sm')}</div>`;
  };
}
