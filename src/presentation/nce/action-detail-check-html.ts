export function createActionDetailCheckHtml(deps: { escape: (value: unknown) => string }) {
  return (label: string, view: { cls: string; label: string }, note?: string) => `<div class="action-detail-check"><div><b>${deps.escape(label)}</b>${note ? `<div class="hint">${deps.escape(note)}</div>` : ''}</div><span class="tag ${view.cls}">${deps.escape(view.label)}</span></div>`;
}
