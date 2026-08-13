export function createEntryTreeInteractionWorkflow(deps: {
  detailState: (keys: Iterable<unknown>, key: unknown, open: boolean) => Set<unknown>;
  openState: (keys: Iterable<unknown>, key: unknown) => { keys: Set<unknown>; open: boolean };
  collapsedToggle: (value: boolean) => boolean;
  keyCommand: (key: string, expanded: string | null) => 'toggle' | 'navigate' | null;
  navigationTarget: (items: readonly any[], current: any, key: any) => any;
  visibility: (nodes: readonly any[], query: any, openKeys: any) => boolean[];
  machineFilter: (value: unknown) => { machine: unknown };
  selection: { pick: (testId: unknown, level: unknown) => unknown; focus: (selection: any, level: unknown) => unknown; previousLotKey: (selection: any, level: unknown) => unknown };
  previousLot: (entries: Map<unknown, unknown>, key: unknown, lot?: unknown) => Map<unknown, unknown>;
}) {
  return Object.freeze({
    detailState: deps.detailState,
    toggleOpen: deps.openState,
    toggleCollapsed: deps.collapsedToggle,
    keyCommand: deps.keyCommand,
    navigationTarget: deps.navigationTarget,
    visibility: deps.visibility,
    machineFilter: deps.machineFilter,
    selection: deps.selection,
    previousLot: deps.previousLot,
  });
}
