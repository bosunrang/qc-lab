type Action = Record<string, any>;

export type ActionRecordServiceDeps = {
  now: () => string;
  createId: () => string;
  isCancelled: (action: Action) => boolean;
  approvalStatus: (action: Action) => string;
};

const effectivenessKeys = ['effectivenessStatus', 'effectivenessNote', 'effectivenessDate', 'residualSeverity', 'residualOccurrence', 'residualDetectability', 'residualRiskLevel', 'residualRiskBasis'];

export function createActionRecordService(deps: ActionRecordServiceDeps) {
  const userFields = (user: { id?: string; username?: string; name?: string }) => ({
    createdByUserId: user.id || '', createdByUsername: user.username || '',
    contentEditorUserIds: [user.id || ''].filter(Boolean), contentEditorUsernames: [String(user.username || '').trim().toLowerCase()].filter(Boolean),
  });
  const create = (actions: Action[], values: Action, user: { id?: string; username?: string; name?: string }) => {
    const now = deps.now(), effective = values.effectivenessStatus !== 'pending';
    const record = { id: deps.createId(), ...values, createdAt: now, updatedAt: now, ...userFields(user),
      effectivenessBy: effective ? user.name || '' : '', effectivenessAt: effective ? now : '',
      approvalStatus: 'pending', recordStatus: 'active', approvedAt: '', approvedBy: '', approvalNote: '' };
    actions.push(record); return record;
  };
  const update = (action: Action, values: Action, user: { id?: string; username?: string; name?: string }) => {
    if (deps.isCancelled(action) || deps.approvalStatus(action) === 'approved') return null;
    const now = deps.now(), effective = values.effectivenessStatus !== 'pending';
    const changed = effectivenessKeys.some(key => String(values[key] ?? '') !== String(action[key] ?? (key === 'effectivenessStatus' ? 'pending' : '')));
    const editorIds = [...new Set([...(action.contentEditorUserIds || []), user.id || ''].filter(Boolean))];
    const editorNames = [...new Set([...(action.contentEditorUsernames || []), String(user.username || '').trim().toLowerCase()].filter(Boolean))];
    Object.assign(action, values, { updatedAt: now, contentEditorUserIds: editorIds, contentEditorUsernames: editorNames,
      approvalStatus: 'pending', approvedAt: '', approvedBy: '', approvalNote: '',
      effectivenessBy: effective ? (changed ? user.name || '' : action.effectivenessBy || user.name || '') : '',
      effectivenessAt: effective ? (changed ? now : action.effectivenessAt || now) : '' });
    return action;
  };
  return Object.freeze({ create, update });
}

export type ActionRecordService = ReturnType<typeof createActionRecordService>;
