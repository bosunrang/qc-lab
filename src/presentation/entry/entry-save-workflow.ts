type SaveInput = { test: unknown; config: unknown; canEnter: boolean; value: unknown };
type Feedback = { cls: string; emphasis: boolean; message: string } | null;

export function createEntrySaveWorkflow(deps: {
  inputPlan: (input: SaveInput) => { state: string };
  warningPlan: (issues: readonly unknown[]) => { state: string; issues: string[] };
  unavailableHtml: (commit?: boolean) => string;
  invalidInputHtml: () => string;
  sdZeroWarningHtml: (issues: readonly unknown[]) => string;
  unusualIssuesHtml: (issues: readonly unknown[]) => string;
  unusualModalHtml: (input: { issuesHtml: string; confirmAction: string }) => string;
  auditDetail: (input: { dateText: string; level: unknown; parallel: boolean; lotNo?: unknown; valueText: string }) => string;
  messageHtml: (input: { feedback: Feedback; verdict: string; tag: string; rules: readonly unknown[]; dateText: string }) => string;
}) {
  return Object.freeze({
    preflight: deps.inputPlan,
    warnings: deps.warningPlan,
    unavailableHtml: deps.unavailableHtml,
    invalidInputHtml: deps.invalidInputHtml,
    sdZeroWarningHtml: deps.sdZeroWarningHtml,
    unusualIssuesHtml: deps.unusualIssuesHtml,
    unusualModalHtml: deps.unusualModalHtml,
    auditDetail: deps.auditDetail,
    messageHtml: deps.messageHtml,
  });
}
