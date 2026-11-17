// Bản nháp theo người dùng, phạm vi và bước xem xét; không sửa hồ sơ đã ký.
import type { EqaReportScope, EqaReportView, EqaReviewDraft, EqaReviewKind } from '../../shared/qc-api';

export function eqaReportDraftKey(userId: string, scope: EqaReportScope, kind: EqaReviewKind): string {
  return JSON.stringify([userId, scope.programId, scope.year, scope.roundId || '', scope.instrumentId || '', kind]);
}

export function initialEqaReportDraft(report: EqaReportView, kind: EqaReviewKind): EqaReviewDraft {
  const current = report.reviews.filter((r) => r.current);
  const previous = current.find((r) => r.kind === kind);
  const common = current[0];
  return {
    scope: report.scope, expectedFingerprint: report.fingerprint, kind,
    conclusion: previous?.conclusion || '', assessment: previous?.assessment || 'pending',
    receivedDate: current.find((r) => r.received_date)?.received_date || '',
    warningNote: previous?.warning_note || common?.warning_note || '',
    communication: common?.communication || '', communicationDate: common?.communication_date || '',
    carDecision: common?.car_decision || 'pending', carReference: common?.car_reference || '',
    nextReviewDate: common?.next_review_date || '',
    alternatives: (previous?.alternatives || []).map((a) => ({ ...a })),
  };
}

export function sameEqaReportDraft(a: EqaReviewDraft, b: EqaReviewDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
