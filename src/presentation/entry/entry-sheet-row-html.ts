type EntrySheetRowInput = {
  rowClass: string;
  date: string;
  day: string;
  today: boolean;
  cellsHtml: string;
  staffHtml: string;
  warningRules: string;
  rejectionRules: string;
  statusHtml: string;
  noteHtml: string;
};

type EntrySheetRowDependencies = { escape: (value: unknown) => string };

export function createEntrySheetRowHtml(deps: EntrySheetRowDependencies) {
  return (input: EntrySheetRowInput) => `<tr class="${deps.escape(input.rowClass)}" data-date="${deps.escape(input.date)}"><td><span>${deps.escape(input.day)}</span>${input.today ? '<b>Hôm nay</b>' : ''}</td>${input.cellsHtml}<td class="qc-staff-cell">${input.staffHtml}</td><td>${deps.escape(input.warningRules)}</td><td>${deps.escape(input.rejectionRules)}</td><td>${input.statusHtml}</td><td>${input.noteHtml}</td></tr>`;
}
