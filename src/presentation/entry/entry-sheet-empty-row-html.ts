type EntrySheetEmptyRowInput = { columnCount: number };

export function entrySheetEmptyRowHtml(input: EntrySheetEmptyRowInput) {
  return `<tr><td colspan="${input.columnCount}" class="empty-cell">Chưa có điểm nào trong khoảng này.</td></tr>`;
}
