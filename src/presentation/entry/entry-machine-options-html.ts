type EntryMachineOptionsInput = { machines: string[]; selected: string };

type EntryMachineOptionsDependencies = { escape: (value: unknown) => string };

export function createEntryMachineOptionsHtml(deps: EntryMachineOptionsDependencies) {
  return (input: EntryMachineOptionsInput) => ['<option value="all">Tất cả máy</option>', ...input.machines.map(machine => `<option value="${deps.escape(machine)}" ${input.selected === machine ? 'selected' : ''}>${deps.escape(machine)}</option>`)].join('');
}
