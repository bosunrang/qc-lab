type VoidPlan = { state: string };
type Point = { voided?: boolean } | null | undefined;
type Verdict = { rules?: unknown; level?: unknown } | null | undefined;
type VoidContext = { rules: string[]; rule: string; qcVerdict: string; qcErrorType: unknown };
type ReasonError = { showError: boolean; focusReason: boolean };
type VoidDialog = { kicker: string; title: string; message: string; detail: string; confirmLabel: string; cancelLabel: string };

export function createEntryVoidWorkflow(deps: {
  plan: (test: unknown, point: Point) => VoidPlan;
  modalHtml: (input: { dateText: string; level: number; valueText: string; confirmAction: string }) => string;
  reasonValid: (kind: unknown, reason: string) => boolean;
  reasonError: (valid: boolean) => ReasonError;
  pointContext: (verdict: Verdict) => VoidContext;
  confirmDetail: (openNce: boolean) => string;
  confirmDialog: (detail: string) => VoidDialog;
  periodLockedHtml: () => string;
  auditDetail: (input: { dateText: string; level: unknown; valueText: string; reason: string }) => string;
  feedbackHtml: (input: { dateText: string; openNce: boolean; reusedAction: boolean; nceId: unknown }) => string;
}) {
  return Object.freeze({
    preflight: deps.plan,
    modalHtml: deps.modalHtml,
    reasonValid: deps.reasonValid,
    reasonError: deps.reasonError,
    pointContext: deps.pointContext,
    confirmOptions: (openNce: boolean) => deps.confirmDialog(deps.confirmDetail(openNce)),
    periodLockedHtml: deps.periodLockedHtml,
    auditDetail: deps.auditDetail,
    feedbackHtml: deps.feedbackHtml,
  });
}
