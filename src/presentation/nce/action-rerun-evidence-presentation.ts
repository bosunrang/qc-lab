type Action = Record<string, any>;
type Point = Record<string, any>;
type Test = Record<string, any>;

export type ActionRerunEvidencePresentationDeps = {
  pointForAction: (action: Action) => Point | null;
  levelShort: (test: Test | null | undefined, level: unknown, lot?: unknown) => string;
};

export function createActionRerunEvidencePresentation(deps: ActionRerunEvidencePresentationDeps) {
  const model = (action: Action, rerunStatus: Record<string, any> | null | undefined, test: Test | null | undefined) => {
    const sourcePoint = deps.pointForAction(action);
    if (!sourcePoint || !rerunStatus?.needed) return null;
    if (!rerunStatus.point) return {
      kind: 'pending' as const, cls: 'warn', heading: 'Chưa có kết quả phù hợp',
      label: rerunStatus.label || 'Đang chờ QC chạy lại được chấp nhận', point: null,
    };
    const point = rerunStatus.point as Point;
    return {
      kind: 'accepted' as const, cls: rerunStatus.cls === 'warn' ? 'warn' : 'ok',
      heading: rerunStatus.cls === 'warn' ? 'QC được chấp nhận kèm cảnh báo' : 'QC chạy lại được chấp nhận',
      point, context: deps.levelShort(test, point.level, point.lot),
    };
  };
  return Object.freeze({ model });
}

export type ActionRerunEvidencePresentation = ReturnType<typeof createActionRerunEvidencePresentation>;
