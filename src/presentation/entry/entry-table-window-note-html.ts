type EntryTableWindowNoteInput = { limited: boolean; expanded: boolean; shown: number; total: number; actionButtonHtml: string };

export function entryTableWindowNoteHtml(input: EntryTableWindowNoteInput) {
  if (input.limited) return `<div class="table-window-note">Đang hiển thị ${input.shown}/${input.total} điểm gần nhất. ${input.actionButtonHtml}</div>`;
  if (input.expanded && input.total > 0) return `<div class="table-window-note">Đang hiển thị toàn bộ ${input.total} điểm. ${input.actionButtonHtml}</div>`;
  return '';
}
