export function entryVoidPlan(test: unknown, point: { voided?: boolean } | null | undefined) {
  return test && point && !point.voided ? { state: 'ready' as const } : { state: 'unavailable' as const };
}
