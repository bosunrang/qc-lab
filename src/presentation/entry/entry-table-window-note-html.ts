type EntryTableWindowNoteInput = {
  visible: number;
  total: number;
  limited: boolean;
  expanded: boolean;
  initialRows: number;
  toggleAction: string;
};

type EntryTableWindowNoteDependencies = { button: (label: string, action: string, variant: string) => string };

export function createEntryTableWindowNoteHtml(deps: EntryTableWindowNoteDependencies) {
  return (input: EntryTableWindowNoteInput) => input.limited
    ? `<div class="table-window-note">Đang hiển thị ${input.visible}/${input.total} điểm gần nhất. ${deps.button('Hiện toàn bộ', input.toggleAction, 'ghost sm')}</div>`
    : input.expanded && input.total > input.initialRows
      ? `<div class="table-window-note">Đang hiển thị toàn bộ ${input.total} điểm. ${deps.button('Thu gọn', input.toggleAction, 'ghost sm')}</div>`
      : '';
}
