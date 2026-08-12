export function createManageToolbarHtml(deps: { escape: (value: unknown) => string; escapeAttr: (value: unknown) => string; button: (label: string, action: string, variant: string) => string }) {
  return (model: { title: string; subtitle?: string; placeholder?: string; query?: string; action?: string; actionLabel?: string }) => {
    const search = model.placeholder ? `<input id="manageSearch" placeholder="${deps.escapeAttr(model.placeholder)}" value="${deps.escapeAttr(model.query || '')}" oninput="manageSearchSet(this.value)">` : '';
    return `<div class="rcfg-toolbar"><div><h2>${deps.escape(model.title)}</h2>${model.subtitle ? `<p>${deps.escape(model.subtitle)}</p>` : ''}</div><div class="rcfg-tools">${search}${model.action ? deps.button('＋ ' + (model.actionLabel || ''), model.action, 'teal') : ''}</div></div>`;
  };
}
