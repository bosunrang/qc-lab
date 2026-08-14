export type EntryEmptyPageInput = {
  title: string;
  message: string;
  actionHtml?: string;
};

export function createEntryEmptyPageHtml(deps: { head: (title: string, subtitle: string) => string; empty: (title: string, message: string, action?: string) => string }) {
  return (input: EntryEmptyPageInput) => `${deps.head('Nhập QC', '')}<div class="panel">${deps.empty(input.title, input.message, input.actionHtml || '')}</div>`;
}
