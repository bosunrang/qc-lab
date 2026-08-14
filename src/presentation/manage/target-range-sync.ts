export type TargetRangeSyncSource = 'limits'|'target';
export type TargetRangeSyncValues = { mean: number; sd: number; low: number; high: number };
export type TargetRangeSyncDeps = { targetFromLimits: (low: number, high: number) => { mean: number; sd: number }|null; limitsFromTarget: (mean: number, sd: number) => { low: number; high: number }|null };

export function createTargetRangeSync(deps: TargetRangeSyncDeps) {
  return (source: TargetRangeSyncSource, values: TargetRangeSyncValues) => source==='limits'?deps.targetFromLimits(values.low,values.high):deps.limitsFromTarget(values.mean,values.sd);
}
