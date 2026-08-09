type Lock = Record<string, any>;

export function createReportPeriodPresentation() {
  const currentYearMonth = (value: unknown, fallback: string) => /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : fallback;
  const setPart = (yearMonth: string, part: 'year' | 'month', value: unknown) => {
    const match = /^(\d{4})-(\d{2})$/.exec(yearMonth);
    if (!match) return yearMonth;
    const year = part === 'year' ? Number(value) : Number(match[1]), month = part === 'month' ? Number(value) : Number(match[2]);
    return `${year}-${String(month).padStart(2, '0')}`;
  };
  const sortedLocks = (locks: Lock[] | null | undefined) => [...(locks || [])].sort((a, b) => String(b.ym || '').localeCompare(String(a.ym || '')));
  return Object.freeze({ currentYearMonth, setPart, sortedLocks });
}

export type ReportPeriodPresentation = ReturnType<typeof createReportPeriodPresentation>;
