export function entryRangePreset(days: number) {
  return { days: Math.min(90, days), start: null, end: null };
}
