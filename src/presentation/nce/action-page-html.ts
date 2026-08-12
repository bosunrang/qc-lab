type ActionPageInput = { headHtml: string; issuesHtml: string; formHtml: string; logHtml: string };

export function createActionPageHtml() {
  return (input: ActionPageInput) => `${input.headHtml}${input.issuesHtml}${input.formHtml}${input.logHtml}`;
}
