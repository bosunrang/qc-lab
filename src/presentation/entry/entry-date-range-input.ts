export function createEntryDateRangeInput(parseDate: (value: unknown) => string | null | undefined) {
  return (current: { start?: string | null; end?: string | null }, field: 'start' | 'end', value: unknown) => {
    const date = parseDate(value) || null;
    return field === 'start' ? { start: date, end: current.end || null } : { start: current.start || null, end: date };
  };
}
