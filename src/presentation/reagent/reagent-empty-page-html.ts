type ReagentEmptyPageInput = { headHtml: string; emptyStateHtml: string };

export function reagentEmptyPageHtml(input: ReagentEmptyPageInput): string {
  return `${input.headHtml}<div class="panel">${input.emptyStateHtml}</div>`;
}
