export type ManageShellItem = { id: string; label: string; count: string | number };

export function createManageShellHtml(deps: { escape: (value: unknown) => string }) {
  return (items: ManageShellItem[], selected: string, body: string) => `<div class="config-shell"><aside class="config-shell-nav" aria-label="Danh mục cấu hình"><div class="rcfg-title">CẤU HÌNH CHUNG</div>${items.map(item => `<button class="${selected === item.id ? 'on' : ''}" data-action="setManageTab" data-args='${JSON.stringify([item.id])}'><b>${deps.escape(item.label)}</b><small>${deps.escape(item.count)}</small></button>`).join('')}</aside><section class="config-shell-main">${body}</section></div>`;
}
