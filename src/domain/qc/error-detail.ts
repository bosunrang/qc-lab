export function createQcErrorDetail(deps: {
  errorType: (rules: string[]) => string;
  primaryRule: (rules: string[]) => string;
  descriptions: Record<string, string>;
}) {
  return (rules: string[]) => {
    const type = deps.errorType(rules);
    return type === '—' ? { type, desc: '' } : { type, desc: deps.descriptions[deps.primaryRule(rules)] || '' };
  };
}
