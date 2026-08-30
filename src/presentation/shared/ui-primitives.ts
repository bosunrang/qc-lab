export type BtnAction = { action: string; args?: unknown[] };

export function createUiPrimitives(deps: { escapeAttr: (value: unknown) => string }) {
  /* Pha H2 (2026-08-20): `onclick` nhận thêm dạng {action,args} — sinh
     data-action/data-args cho action-dispatcher.ts (event delegation) thay
     vì chuỗi JS source nhúng thẳng vào onclick="...". Dạng string cũ (chuỗi
     JS trần) vẫn còn dùng ở những chỗ chưa chuyển — tương thích song song có
     chủ đích trong lúc chuyển từng lát, không phải nợ kỹ thuật để lại. */
  const btn = (label: string, onclick: string | BtnAction | null, cls = 'ghost sm', title = '', opts: { disabled?: boolean; attrs?: Record<string, unknown> } = {}) => {
    const { disabled = false, attrs = {} } = opts;
    const isAction = onclick != null && typeof onclick === 'object';
    const clickAttr = typeof onclick === 'string' ? ` onclick="${onclick}"` : '';
    const allAttrs: Record<string, unknown> = isAction
      ? { 'data-action': (onclick as BtnAction).action, ...((onclick as BtnAction).args?.length ? { 'data-args': JSON.stringify((onclick as BtnAction).args) } : {}), ...attrs }
      : attrs;
    const attrStr = Object.entries(allAttrs).map(([k, v]) => ` ${k}="${deps.escapeAttr(v)}"`).join('');
    return `<button class="btn ${cls}"${disabled ? ' disabled' : ''}${clickAttr}${title ? ` title="${deps.escapeAttr(title)}"` : ''}${attrStr}>${label}</button>`;
  };
  const emptyState = (title: string, body: string, actions = '') => `<div class="empty"><div class="empty-title">${title}</div><div>${body}</div>${actions ? `<div class="empty-actions">${actions}</div>` : ''}</div>`;
  return { btn, emptyState };
}
