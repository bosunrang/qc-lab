type Action = string | { action: string; args?: unknown[] } | null;
export function createManageToolbarHtml(deps: { escape: (value: unknown) => string; escapeAttr: (value: unknown) => string; button: (label: string, action: Action, variant: string) => string }) {
  return (model: { title: string; subtitle?: string; placeholder?: string; query?: string; action?: Action; actionLabel?: string }) => {
    const search = model.placeholder ? `<input id="manageSearch" placeholder="${deps.escapeAttr(model.placeholder)}" value="${deps.escapeAttr(model.query || '')}" data-action="manageSearchSet" data-action-on="input">` : '';
    return `<div class="rcfg-toolbar"><div><h2>${deps.escape(model.title)}</h2>${model.subtitle ? `<p>${deps.escape(model.subtitle)}</p>` : ''}</div><div class="rcfg-tools">${search}${model.action ? deps.button('＋ ' + (model.actionLabel || ''), model.action, 'teal') : ''}</div></div>`;
  };
}
