type Action = Record<string, any>;

export function createActionReviewPresentation() {
  const approvalTag = (approval: string, cancelled: boolean) => ({
    cls: cancelled ? 'none' : approval === 'approved' ? 'ok' : approval === 'returned' ? 'rej' : 'warn',
  });
  const buttons = (action: Action, context: {
    approval: string; workflowStage: string; cancelled: boolean; isAdmin: boolean;
    canWrite: boolean; canEscalate: boolean; canReopen: boolean;
  }) => ({
    edit: !context.cancelled && context.approval !== 'approved' && context.canWrite,
    escalate: context.canEscalate && context.canWrite,
    approve: context.isAdmin && context.workflowStage === 'approval',
    returnForRevision: context.isAdmin && context.workflowStage === 'approval',
    reopen: context.isAdmin && context.canReopen,
    cancel: context.isAdmin && !context.cancelled && context.approval !== 'approved',
  });
  return Object.freeze({ approvalTag, buttons });
}

export type ActionReviewPresentation = ReturnType<typeof createActionReviewPresentation>;
