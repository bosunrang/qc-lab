type EntrySheetDayRowInput = { rowClass: string; date: string; dayOfMonth: number; today: boolean; cellsHtml: string; staffHtml: string; warningRules: string; rejectRules: string; statusHtml: string; noteHtml: string };

export function entrySheetDayRowHtml(input: EntrySheetDayRowInput) {
  return `<tr class="${input.rowClass}" data-date="${input.date}"><td><span>${input.dayOfMonth}</span>${input.today ? '<b>Hôm nay</b>' : ''}</td>${input.cellsHtml}<td class="qc-staff-cell">${input.staffHtml}</td><td>${input.warningRules || '—'}</td><td>${input.rejectRules || '—'}</td><td>${input.statusHtml}</td><td>${input.noteHtml}</td></tr>`;
}
