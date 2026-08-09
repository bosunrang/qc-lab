import { nceActionLabels } from './action-labels';

export function actionApprovalStatus(action: Record<string, any> | null | undefined): 'pending' | 'approved' | 'returned' {
  return action && ['pending', 'approved', 'returned'].includes(action.approvalStatus) ? action.approvalStatus : 'pending';
}

export function actionRecordStatus(action: Record<string, any> | null | undefined): 'active' | 'cancelled' {
  return action && action.recordStatus === 'cancelled' ? 'cancelled' : 'active';
}

export function actionCancelled(action: Record<string, any> | null | undefined): boolean {
  return actionRecordStatus(action) === 'cancelled';
}

export function actionApprovalLabel(action: Record<string, any> | null | undefined): string {
  if (actionCancelled(action)) return 'Đã hủy hồ sơ';
  const status = actionApprovalStatus(action);
  return status === 'approved' ? 'Đã duyệt' : status === 'returned' ? 'Trả lại' : 'Chờ duyệt';
}

export function actionRecorded(action: Record<string, any> | null | undefined): boolean {
  return !!(action && !action.autoCreated && String(action.by || '').trim()
    && (action.protocolVersion >= 2 ? String(action.correction || '').trim().length >= 5 : String(action.action || '').trim().length >= 5));
}

export function actionRiskScore(action: Record<string, any> | null | undefined): number {
  const values = [action?.riskSeverity, action?.riskOccurrence, action?.riskDetectability].map(Number);
  return values.every(value => Number.isInteger(value) && value >= 1 && value <= 5) ? values.reduce((total, value) => total * value, 1) : 0;
}

export function actionResidualRiskScore(action: Record<string, any> | null | undefined): number {
  return actionRiskScore({
    riskSeverity: action?.residualSeverity, riskOccurrence: action?.residualOccurrence,
    riskDetectability: action?.residualDetectability,
  });
}

export const nceActionBasics = Object.freeze({
  actionApprovalStatus, actionRecordStatus, actionCancelled, actionApprovalLabel, actionRecorded,
  actionRiskScore, actionResidualRiskScore, actionLabels: nceActionLabels.actionLabels,
});

export type NceActionBasics = typeof nceActionBasics;
