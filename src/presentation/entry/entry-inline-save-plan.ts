export function entryInlineSavePlan(input: { test: unknown; config: unknown; canEnter: boolean; value: unknown }) {
  if (!input.test || !input.config || !input.canEnter) return { state: 'unavailable' as const };
  if (input.value == null || String(input.value).trim() === '') return { state: 'empty' as const };
  return { state: 'ready' as const };
}
