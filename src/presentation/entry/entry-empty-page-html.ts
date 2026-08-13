type EntryEmptyPageInput = { title: string; description: string; actionHtml: string };

type EntryEmptyPageDependencies = { head: (title: string, subtitle: string) => string };

export function createEntryEmptyPageHtml(deps: EntryEmptyPageDependencies) {
  return (input: EntryEmptyPageInput) => deps.head('Nhập QC', '') + `<div class="panel"><div class="empty"><div class="empty-title">${input.title}</div><div>${input.description}</div>${input.actionHtml ? `<div class="empty-actions">${input.actionHtml}</div>` : ''}</div></div>`;
}
