export function createEntryTableInteractionWorkflow(deps: {
  extraRunRequest: (testId: unknown, columnKey: unknown, date: unknown, levelIndex: unknown, runNo: unknown) => { key: string; focus: string };
  extraRunState: (keys: Iterable<unknown>, request: { key: string; focus: string }) => { keys: Set<unknown>; focus: string };
  rangePreset: (days: any) => any;
  rangeState: (days: any, range: any) => any;
  dateRangeInput: (range: any, side: 'start' | 'end', value: unknown) => any;
  dateNoteFeedback: (note: string, dateText: string) => unknown;
  dateNoteErrorMessage: (error: unknown) => string;
}) {
  return Object.freeze({
    unlockExtraRun: (keys: Iterable<unknown>, testId: unknown, columnKey: unknown, date: unknown, levelIndex: unknown, runNo: unknown) => deps.extraRunState(keys,deps.extraRunRequest(testId,columnKey,date,levelIndex,runNo)),
    presetRange: (days: unknown, value: unknown) => deps.rangeState(days,deps.rangePreset(value)),
    dateRange: (days: unknown, range: { start: unknown; end: unknown }, side: 'start' | 'end', value: unknown) => deps.rangeState(days,deps.dateRangeInput(range,side,value)),
    dateNoteFeedback: deps.dateNoteFeedback,
    dateNoteErrorMessage: deps.dateNoteErrorMessage,
  });
}
