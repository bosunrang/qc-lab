export function createEntryUnusualDataIssuesHtml(deps: { escape: (value: unknown) => string }) {
  return (issues: readonly unknown[]) => issues.map(issue => `<div class="alert warn">${deps.escape(issue)}</div>`).join('');
}
