export function entryQcWarningPlan(issues: readonly unknown[]) {
  const items = [...issues].map(item => String(item));
  if (items.some(item => item.includes('SD đang bằng 0'))) return { state: 'blocked' as const, issues: items };
  return items.length ? { state: 'confirm' as const, issues: items } : { state: 'ready' as const, issues: items };
}
