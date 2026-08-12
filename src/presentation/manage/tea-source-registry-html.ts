export type TeaSourceRegistryItem = { status: string; label: string; statusLabel: string; tagClass: string; version: string; effectiveDate?: string; reviewedDate: string; url: string };

export function createTeaSourceRegistryHtml(deps: { escape: (value: unknown) => string; escapeAttr: (value: unknown) => string }) {
  return (items: TeaSourceRegistryItem[]) => `<div class="tea-source-registry">${items.map(item => `<div class="tea-source-card ${item.status}"><div><b>${deps.escape(item.label)}</b><span class="tag ${item.tagClass}">${deps.escape(item.statusLabel)}</span></div><p>${deps.escape(item.version)}${item.effectiveDate ? ' · hiệu lực ' + deps.escape(item.effectiveDate) : ''} · rà soát ${deps.escape(item.reviewedDate)}</p><a href="${deps.escapeAttr(item.url)}" target="_blank" rel="noopener">Mở nguồn chính thức</a></div>`).join('')}</div>`;
}
