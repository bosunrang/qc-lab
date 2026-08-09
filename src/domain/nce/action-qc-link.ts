export type ActionQcLinkDeps = {
  pointForAction: (action: Record<string, any>) => Record<string, any> | null;
  findTest: (testId: unknown) => Record<string, any> | undefined;
  westgard: (test: Record<string, any>) => { byPoint: Map<string, { level?: string }> };
};

export function createActionQcLink(deps: ActionQcLinkDeps) {
  const eventDate = (action: Record<string, any> | null | undefined): string => {
    const point = action ? deps.pointForAction(action) : null;
    return String(point?.date || action?.date || '');
  };
  const needsRerun = (action: Record<string, any> | null | undefined): boolean => {
    if (!action) return false;
    const test = deps.findTest(action.testId), point = deps.pointForAction(action);
    if (!test || !point) return false;
    if (point.voided) return point.voidRequiresRerun == null ? point.voidKind !== 'data-entry' : !!point.voidRequiresRerun;
    return deps.westgard(test).byPoint.get(point.id)?.level === 'rej';
  };
  return Object.freeze({ eventDate, needsRerun });
}

export type ActionQcLink = ReturnType<typeof createActionQcLink>;
