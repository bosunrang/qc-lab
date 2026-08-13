export function entryRangeState(currentDays: unknown, range: { days?: unknown; start?: string | null; end?: string | null }) {
  return {
    days: range.days == null ? currentDays : range.days,
    start: range.start || null,
    end: range.end || null,
  };
}
