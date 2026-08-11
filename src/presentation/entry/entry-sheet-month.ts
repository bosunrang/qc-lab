export function entrySheetMonthValue(value: unknown) {
  const month = String(value || '');
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
}

export function entrySheetMonthPart(current: unknown, fallback: string, part: 'year' | 'month', value: unknown) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(current || fallback));
  if (!match) return fallback;
  const year = part === 'year' ? Number(value) : Number(match[1]);
  const month = part === 'month' ? Number(value) : Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return fallback;
  return `${year}-${String(month).padStart(2, '0')}`;
}
