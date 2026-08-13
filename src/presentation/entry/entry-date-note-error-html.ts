export function createEntryDateNoteErrorHtml(deps: { escape: (value: unknown) => string }) {
  return (message: unknown) => message ? `<div class="alert warn">${deps.escape(message)}</div>` : '';
}
