export function createEntrySdZeroWarningHtml(deps: { escape: (value: unknown) => string }) {
  return (issues: readonly unknown[]) => `<div class="alert rej"><b>Không thể lưu.</b> ${deps.escape(issues.join(' '))}</div>`;
}
