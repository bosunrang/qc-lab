type Action = Record<string, any>;

export type ActionEscalationServiceDeps = {
  now: () => string;
  today: () => string;
  createId: () => string;
  nextNceId: (actions: Action[], today: string) => string;
  dueDate: (days: number) => string;
  isCancelled: (action: Action) => boolean;
  approvalStatus: (action: Action) => string;
  activeFollowUp: (actions: Action[], action: Action) => Action | null;
};

export function createActionEscalationService(deps: ActionEscalationServiceDeps) {
  const canEscalate = (actions: Action[], action: Action | null | undefined) => !!action
    && !deps.isCancelled(action) && Number(action.protocolVersion) >= 2
    && action.effectivenessStatus === 'ineffective' && !deps.activeFollowUp(actions || [], action)
    && deps.approvalStatus(action) !== 'approved';
  const createFollowUp = (actions: Action[], parent: Action | null | undefined, user: { id?: string; username?: string; name?: string }) => {
    if (!canEscalate(actions || [], parent)) return null;
    const parentId = parent!.nceId || 'hồ sơ trước', now = deps.now(), nceId = deps.nextNceId(actions || [], deps.today());
    const username = String(user.username || '').trim().toLowerCase();
    const record: Action = {
      id: deps.createId(), nceId, parentNceId: parent!.nceId || '', date: deps.today(), createdAt: now, updatedAt: now,
      createdByUserId: user.id || '', createdByUsername: user.username || '',
      contentEditorUserIds: [user.id || ''].filter(Boolean), contentEditorUsernames: [username].filter(Boolean),
      testId: parent!.testId, level: parent!.level, lot: parent!.lot || '', pointId: parent!.pointId || '', rule: parent!.rule || '', errorType: parent!.errorType || '', qcVerdict: parent!.qcVerdict || '',
      protocolVersion: 3, eventSource: parent!.eventSource || 'iqc', processPhase: parent!.processPhase || 'exam', containmentStatus: parent!.containmentStatus || '', containmentNote: parent!.containmentNote || '',
      correction: `Hành động của ${parentId} được đánh giá chưa hiệu lực, mở vòng điều tra mới.`, by: user.name || '', dueDate: deps.dueDate(7),
      effectivenessStatus: 'pending', approvalStatus: 'pending', recordStatus: 'active', approvedAt: '', approvedBy: '', approvalNote: '',
    };
    parent!.followUpNceId = nceId;
    (actions || []).push(record);
    return record;
  };
  return Object.freeze({ canEscalate, createFollowUp });
}

export type ActionEscalationService = ReturnType<typeof createActionEscalationService>;
