type Value = Record<string, any>;

export function createReportSearch() {
  const select = (tests: Value[], query: string, currentId: string, values: (test: Value) => any[], normalize: (value: any) => string) => {
    const needle = normalize(query);
    const matched = tests.filter(test => !needle || values(test).some(value => normalize(value).includes(needle)));
    return { matched, selected: matched.some(test => test.id === currentId) ? currentId : (matched[0]?.id || '') };
  };
  return Object.freeze({ select });
}
export type ReportSearch = ReturnType<typeof createReportSearch>;
