export type ActionApprovalGateDeps = {
  todayIso: () => string;
  isCancelled: (action: Record<string, any>) => boolean;
  isRecorded: (action: Record<string, any>) => boolean;
  workflowComplete: (action: Record<string, any>) => boolean;
};

export function createActionApprovalGates(deps: ActionApprovalGateDeps) {
  const overdue = (action: Record<string, any> | null | undefined) => {
    const due = String(action?.dueDate || '').trim();
    if (!due || !action || deps.isCancelled(action) || !deps.isRecorded(action) || deps.workflowComplete(action)) {
      return { overdue: false, days: 0, label: '' };
    }
    const today = deps.todayIso();
    if (due >= today) return { overdue: false, days: 0, label: '' };
    const days = Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(due + 'T00:00:00Z')) / 86400000);
    return { overdue: true, days, label: `Quá hạn ${days} ngày` };
  };
  const identityText = (value: unknown) => String(value || '').trim().toLocaleLowerCase('vi');
  const canApprove = (action: Record<string, any> | null | undefined, user: Record<string, any> | null | undefined): boolean => {
    if (!action || !user || deps.isCancelled(action)) return false;
    const userId = String(user.id || ''), username = identityText(user.username);
    const contributorIds = new Set([action.createdByUserId, ...(Array.isArray(action.contentEditorUserIds) ? action.contentEditorUserIds : [])].map(value => String(value || '')).filter(Boolean));
    const contributorNames = new Set([action.createdByUsername, ...(Array.isArray(action.contentEditorUsernames) ? action.contentEditorUsernames : [])].map(identityText).filter(Boolean));
    if (userId && contributorIds.has(userId)) return false;
    if (username && contributorNames.has(username)) return false;
    if (contributorIds.size || contributorNames.size) return true;
    const creator = identityText(action.by), identities = [user.name, user.username].map(identityText).filter(Boolean);
    return !creator || !identities.includes(creator);
  };
  return Object.freeze({ overdue, canApprove });
}

export type ActionApprovalGates = ReturnType<typeof createActionApprovalGates>;
