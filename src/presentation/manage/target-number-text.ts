export type TargetNumberTextDeps = { valueDecimals: (test: unknown) => number; statDecimals: (test: unknown) => number; defaultDecimals: number };

export function createTargetNumberText(deps: TargetNumberTextDeps) {
  return (value: unknown, test: unknown=null, kind: 'value'|'stat'='value') => {
    if(value==null||String(value).trim()===''||!Number.isFinite(Number(value)))return '';
    const digits=test?(kind==='stat'?deps.statDecimals(test):deps.valueDecimals(test)):deps.defaultDecimals;
    return Number(value).toFixed(digits).replace(/(?:\.0+|(\.\d+?)0+)$/,'$1');
  };
}
