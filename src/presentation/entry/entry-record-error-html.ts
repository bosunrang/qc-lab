export function createEntryRecordErrorHtml(deps: { escape: (value: unknown) => string }) {
  return (message: unknown) => `<div class="alert warn">${deps.escape(message)}</div>`;
}
