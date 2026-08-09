type Action = Record<string, any>;

export type ActionReviewServiceDeps = {
  now: () => string;
  isCancelled: (action: Action) => boolean;
  approvalStatus: (action: Action) => string;
  recordStatus: (action: Action) => string;
  workflowStatus: (action: Action) => { stage?: string; complete?: boolean };
  activeFollowUp: (action: Action) => Action | null;
  isRecorded: (action: Action) => boolean;
  protocolStatus: (action: Action) => { complete?: boolean; missing?: string[] };
  rerunStatus: (action: Action) => { needed?: boolean; ok?: boolean; point?: Action | null };
  effectivenessStatus: (action: Action) => { complete?: boolean };
  canApproveByUser: (action: Action, user: Action) => boolean;
};

export function createActionReviewService(deps: ActionReviewServiceDeps) {
  const reviewToken = (action: Action | null | undefined) => {
    const current = action || {};
    const rerun = action ? deps.rerunStatus(action) : {};
    return [current.id || '', current.updatedAt || current.createdAt || '', deps.workflowStatus(current).stage || '', rerun.point && (rerun.point as Action).id || '',
      deps.approvalStatus(current), deps.recordStatus(current)].join('|');
  };
  const cancelReadiness = (action: Action | null | undefined) => {
    if (!action) return { ok: false, reason: 'missing' as const };
    if (deps.isCancelled(action)) return { ok: false, reason: 'cancelled' as const };
    if (deps.approvalStatus(action) === 'approved') return { ok: false, reason: 'approved' as const };
    const followUp = deps.activeFollowUp(action);
    if (followUp) return { ok: false, reason: 'follow-up' as const, followUp };
    return { ok: true, reason: 'ready' as const };
  };
  const reopenReadiness = (action: Action | null | undefined) => {
    if (!action) return { ok: false, reason: 'missing' as const };
    if (deps.isCancelled(action)) return { ok: false, reason: 'cancelled' as const };
    if (deps.approvalStatus(action) !== 'approved') return { ok: false, reason: 'not-approved' as const };
    if (deps.workflowStatus(action).complete) return { ok: false, reason: 'complete' as const };
    return { ok: true, reason: 'ready' as const };
  };
  const returnReadiness = (action: Action | null | undefined) => {
    if (!action) return { ok: false, reason: 'missing' as const };
    if (deps.isCancelled(action)) return { ok: false, reason: 'cancelled' as const };
    if (deps.approvalStatus(action) !== 'pending' || deps.workflowStatus(action).stage !== 'approval') return { ok: false, reason: 'not-pending' as const };
    return { ok: true, reason: 'ready' as const };
  };
  const canCancel = (action: Action | null | undefined) => cancelReadiness(action).ok;
  const canReopen = (action: Action | null | undefined) => reopenReadiness(action).ok;
  const canReturn = (action: Action | null | undefined) => returnReadiness(action).ok;
  const canApprove = (action: Action | null | undefined) => canReturn(action);
  const approvalReadiness = (action: Action | null | undefined, user?: Action) => {
    if (!action) return { ok: false, reason: 'missing' as const };
    if (deps.isCancelled(action)) return { ok: false, reason: 'cancelled' as const };
    if (!deps.isRecorded(action)) return { ok: false, reason: 'unrecorded' as const };
    const protocol = deps.protocolStatus(action);
    if (!protocol.complete) return { ok: false, reason: 'protocol' as const, missing: protocol.missing || [] };
    const rerun = deps.rerunStatus(action);
    if (rerun.needed && !rerun.ok) return { ok: false, reason: 'rerun' as const };
    if (!deps.effectivenessStatus(action).complete) return { ok: false, reason: 'effectiveness' as const };
    if (!canApprove(action)) return { ok: false, reason: 'not-pending' as const };
    if (user && !deps.canApproveByUser(action, user)) return { ok: false, reason: 'non-independent' as const };
    return { ok: true, reason: 'ready' as const };
  };

  const cancel = (action: Action, reason: string, by: string) => {
    if (!canCancel(action) || String(reason || '').trim().length < 5) return false;
    const at = deps.now();
    Object.assign(action, { recordStatus: 'cancelled', cancelReason: reason, cancelledAt: at, cancelledBy: by, updatedAt: at });
    return true;
  };
  const approve = (action: Action, note: string, by: string) => {
    if (!canApprove(action) || String(note || '').trim().length < 3) return false;
    Object.assign(action, { approvalStatus: 'approved', approvedAt: deps.now(), approvedBy: by, approvalNote: note });
    return true;
  };
  const returnForRevision = (action: Action, note: string, by: string) => {
    if (!canReturn(action) || String(note || '').trim().length < 3) return false;
    const at = deps.now();
    Object.assign(action, { approvalStatus: 'returned', approvedAt: at, approvedBy: by, approvalNote: note, returnNote: note, returnBy: by, returnAt: at });
    return true;
  };
  const reopen = (action: Action, note: string) => {
    if (!canReopen(action) || String(note || '').trim().length < 5) return false;
    Object.assign(action, { approvalStatus: 'pending', approvedAt: '', approvedBy: '', approvalNote: `Mở lại: ${note}` });
    return true;
  };
  return Object.freeze({ reviewToken, canCancel, canApprove, canReturn, canReopen, cancelReadiness, reopenReadiness, returnReadiness, approvalReadiness, cancel, approve, returnForRevision, reopen });
}

export type ActionReviewService = ReturnType<typeof createActionReviewService>;
