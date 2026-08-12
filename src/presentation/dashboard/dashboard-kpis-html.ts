type Kpi = { label: string; value: unknown; color?: string; className?: string };

export function dashboardKpisHtml(items: Kpi[]) {
  return `<div class="dash-kpis">${items.map(item => `<div class="dash-kpi"><div class="k">${item.label}</div><div class="v${item.className ? ` ${item.className}` : ''}"${item.color ? ` style="color:${item.color}"` : ''}>${item.value}</div></div>`).join('')}</div>`;
}
