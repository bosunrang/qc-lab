export function reportLockPicker(ym: string, nowYear: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  const year = match ? Number(match[1]) : nowYear;
  const rawMonth = match ? Number(match[2]) : 1;
  const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : 1;
  return { year, month, months: Array.from({ length: 12 }, (_, index) => index + 1), years: Array.from({ length: 5 }, (_, index) => nowYear - 3 + index) };
}
