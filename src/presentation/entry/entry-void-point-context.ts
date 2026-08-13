type Verdict = { rules?: unknown; level?: unknown } | null | undefined;

export function createEntryVoidPointContext(deps: { errorType: (rules: string[]) => unknown }) {
  return (verdict: Verdict) => {
    const rules = [...new Set(Array.isArray(verdict?.rules) ? verdict.rules.map(String) : [])];
    return {
      rules,
      rule: rules.join(', ') || 'Không có luật Westgard',
      qcVerdict: verdict?.level === 'warn' || verdict?.level === 'rej' ? verdict.level : 'invalid',
      qcErrorType: deps.errorType(rules),
    };
  };
}
