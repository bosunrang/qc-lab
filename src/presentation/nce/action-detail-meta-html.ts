export type ActionDetailMetaRow = { label: string; value: string; note?: string };

export function createActionDetailMetaHtml(deps: { escape: (value: unknown) => string }) {
  return (rows: ActionDetailMetaRow[]) => `<div class="action-detail-meta">${rows.map(row => `<div><span>${deps.escape(row.label)}</span><b>${deps.escape(row.value)}</b>${row.note ? `<small>${deps.escape(row.note)}</small>` : ''}</div>`).join('')}</div>`;
}
