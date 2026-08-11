export type EntrySelection = { testId: unknown; level: unknown };

export const entrySelectionState = Object.freeze({
  pick(testId: unknown, level: unknown) {
    return { selection: { testId, level }, start: null, end: null, message: '' };
  },
  focus(selection: EntrySelection | null | undefined, level: unknown): EntrySelection | null {
    return selection ? { testId: selection.testId, level } : null;
  },
  previousLotKey(selection: EntrySelection | null | undefined, level: unknown) {
    return selection ? `${selection.testId}|${level}` : null;
  },
});
