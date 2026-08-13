type Selection = { testId: unknown; level: unknown } | null | undefined;

export function createEntrySelectionRecovery<T>(deps: { id: (test: T) => unknown; levels: (test: T) => Array<{ level: unknown }> }) {
  return (selection: Selection, tests: readonly T[]) => {
    let test = selection ? tests.find(item => deps.id(item) === selection.testId) : undefined;
    if (test && deps.levels(test).some(level => level.level === selection!.level)) {
      return { test, selection, resetAutoOpenKey: false };
    }
    test = tests[0];
    const level = test && deps.levels(test)[0];
    return { test, selection: test && level ? { testId: deps.id(test), level: level.level } : null, resetAutoOpenKey: true };
  };
}
