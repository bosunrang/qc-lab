type EntryRangeButtonsInput = { activeDays: number; hasCustomStart: boolean; days: readonly number[] };

type EntryRangeButtonsDependencies = { presetButton: (input: { active: boolean; days: number; action: string }) => string };

export function createEntryRangeButtonsHtml(deps: EntryRangeButtonsDependencies) {
  return (input: EntryRangeButtonsInput) => input.days.map(days => deps.presetButton({ active: !input.hasCustomStart && input.activeDays === days, days, action: `entrySetDays(${days})` })).join('');
}
