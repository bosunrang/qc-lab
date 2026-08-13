export function entryMachineFilterState(machine: unknown) {
  return { machine: String(machine || 'all') };
}
