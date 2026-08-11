export type ReportSearchTest = { name?: unknown; machine?: unknown; unit?: unknown };
export type ReportSearchLevel = { lot?: unknown };
export type ReportSearchNamed = { name?: unknown };

export type ReportSearchValuesDeps<TTest extends ReportSearchTest> = {
  testLabel: (test: TTest) => unknown;
  operationalLevels: (test: TTest) => readonly ReportSearchLevel[] | null | undefined;
  panelForTest: (test: TTest) => ReportSearchNamed | null | undefined;
  lotGroupForTest: (test: TTest) => ReportSearchNamed | null | undefined;
};

export function reportSearchValues<TTest extends ReportSearchTest>(test: TTest, deps: ReportSearchValuesDeps<TTest>): unknown[] {
  const levels = deps.operationalLevels(test) || [], panel = deps.panelForTest(test), lotGroup = deps.lotGroupForTest(test);
  return [deps.testLabel(test), test.name, test.machine, test.unit, panel?.name, lotGroup?.name, ...levels.map(level => level.lot)];
}

export const reportSearchValuePresentation = Object.freeze({ values: reportSearchValues });
