type Action = Record<string, any>;

export type ActionPointIndexService = ReturnType<typeof createActionPointIndexService>;

export function createActionPointIndexService(getActions: () => Action[]) {
  let memo: { ref: Action[] | null; len: number; index: Map<string, Action[]> | null } = { ref: null, len: -1, index: null };
  const index = () => {
    const actions = getActions() || [];
    if (memo.ref === actions && memo.len === actions.length && memo.index) return memo.index;
    const next = new Map<string, Action[]>();
    actions.forEach(action => { const key = action.pointId, items = next.get(key); if (items) items.push(action); else next.set(key, [action]); });
    memo = { ref: actions, len: actions.length, index: next }; return next;
  };
  const forPoint = (pointId: string) => index().get(pointId) || [];
  const invalidate = () => { memo = { ref: null, len: -1, index: null }; };
  return Object.freeze({ index, forPoint, invalidate });
}
