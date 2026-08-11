type Value = Record<string, any>;

export function createReportSelection() {
  const defaults = (start: string, end: string, monthStart: string, today: string) => ({ start: start || end ? start : `${monthStart}-01`, end: start || end ? end : today });
  const dateRange = (start: string, end: string) => start && end && start > end ? { start: end, end: start } : { start, end };
  const exportSelection = (tests: Value[], testId: string, start: string, end: string, includeNceAppendix: boolean) => ({ tid: testId, t: tests.find(test => test.id === testId), start, end, includeNceAppendix });
  return Object.freeze({ defaults, dateRange, exportSelection });
}
export type ReportSelection = ReturnType<typeof createReportSelection>;
