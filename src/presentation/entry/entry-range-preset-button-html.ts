type EntryRangePresetButtonInput = { active: boolean; days: number; action: string };

type EntryRangePresetButtonDependencies = { escape: (value: unknown) => string };

export function createEntryRangePresetButtonHtml(deps: EntryRangePresetButtonDependencies) {
  return (input: EntryRangePresetButtonInput) => `<button class="${input.active ? 'on' : ''}" onclick="${deps.escape(input.action)}">${input.days} ngày</button>`;
}
