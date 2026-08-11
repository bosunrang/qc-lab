export function entryExtraRunRequest(testId: unknown, columnKey: unknown, date: unknown, levelIndex: unknown, runNo: unknown) {
  return { key: `${testId}|${columnKey}|${date}|${runNo}`, focus: `${date}|${levelIndex}` };
}
