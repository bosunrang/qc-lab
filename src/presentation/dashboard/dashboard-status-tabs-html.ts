type Item = { s: string; missingToday: boolean };
const TABS = [['all', 'Tất cả'], ['missing', 'Chưa QC'], ['rej', 'Loại bỏ'], ['warn', 'Cảnh báo'], ['ok', 'Đạt']] as const;

export function createDashboardStatusTabsHtml(deps: { matches: (item: Item, key: string) => boolean }) {
  return (items: Item[], selected: string) => TABS.map(([key, label]) => {
    const count = key === 'all' ? items.length : items.filter(item => deps.matches(item, key)).length;
    return `<button class="${selected === key ? 'on' : ''}" onclick="dashTestSetStatus('${key}')">${label}<b>${count}</b></button>`;
  }).join('');
}
