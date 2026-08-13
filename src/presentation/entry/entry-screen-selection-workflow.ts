type Selection = { testId: unknown; level: unknown } | null | undefined;
type Recovered<T> = { test: T | undefined; selection: Selection; resetAutoOpenKey: boolean };
type AutoOpen = { keys: Set<unknown>; autoOpenKey: string; changed: boolean };

export function createEntryScreenSelectionWorkflow<T>(deps: {
  recoverSelection: (selection: Selection, tests: readonly T[]) => Recovered<T>;
  machineSelection: (value: unknown, machines: Iterable<unknown>) => string;
  autoOpenState: (keys: Iterable<unknown>, previousKey: unknown, machine: unknown, lotGroupKey: unknown, testId: unknown) => AutoOpen;
}) {
  return Object.freeze({
    recoverSelection: deps.recoverSelection,
    selectMachine: deps.machineSelection,
    autoOpenTree: deps.autoOpenState,
  });
}
