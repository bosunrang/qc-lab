type Action = Record<string, any>;
type Point = Record<string, any>;
type Test = Record<string, any>;

export type ActionViolationServiceDeps = {
  pointForAction: (action: Action) => Point | null;
  findTest: (testId: string) => Test | null;
  levelFor: (test: Test, level: unknown) => Record<string, any> | null;
  errorType: (rules: string[]) => string;
};

export function createActionViolationService(deps: ActionViolationServiceDeps) {
  const info = (action: Action | null | undefined) => {
    const rule = String(action?.rule || ''), recordedError = String(action?.errorType || ''), verdict = String(action?.qcVerdict || '');
    if (rule === 'Hủy điểm QC' || recordedError === 'Quản lý dữ liệu QC') {
      const point = action ? deps.pointForAction(action) : null;
      const test = action ? deps.findTest(String(action.testId || '')) : null;
      const pointMean = Number(point?.qcMean), pointSd = Number(point?.qcSd);
      const level = test && (!pointMean || !pointSd) ? deps.levelFor(test, action?.level) : null;
      const mean = pointMean || Number(level?.mean), sd = pointSd || Number(level?.sd);
      const z = point && Number.isFinite(mean) && sd > 0 ? Math.abs((Number(point.val) - mean) / sd) : 0;
      const guessedRule = z > 3 ? '1-3s' : z > 2 ? '1-2s' : '';
      return {
        rule: guessedRule ? `${guessedRule} (suy từ Z)` : 'Không xác định (hồ sơ cũ)',
        errorType: deps.errorType(guessedRule ? [guessedRule] : []),
        verdict: verdict || (z > 3 ? 'rej' : z > 2 ? 'warn' : 'invalid'), derived: true,
      };
    }
    return { rule: rule || '—', errorType: recordedError || '—', verdict, derived: false };
  };
  const verdictLabel = (action: Action | null | undefined) => {
    const verdict = info(action).verdict;
    return verdict === 'rej' ? 'Loại bỏ' : verdict === 'warn' ? 'Cảnh báo' : verdict === 'invalid' ? 'QC không hợp lệ' : '';
  };
  return Object.freeze({ info, verdictLabel });
}

export type ActionViolationService = ReturnType<typeof createActionViolationService>;
