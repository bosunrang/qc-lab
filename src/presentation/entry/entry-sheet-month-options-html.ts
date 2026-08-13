type EntrySheetMonthOptionsInput = { month: number; year: number; yearMin: number; yearMax: number };

export function createEntrySheetMonthOptionsHtml() {
  return (input: EntrySheetMonthOptionsInput) => ({
    months: Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}" ${input.month === index + 1 ? 'selected' : ''}>Tháng ${index + 1}</option>`).join(''),
    years: Array.from({ length: Math.max(0, input.yearMax - input.yearMin + 1) }, (_, index) => input.yearMin + index).map(year => `<option value="${year}" ${input.year === year ? 'selected' : ''}>${year}</option>`).join(''),
  });
}
