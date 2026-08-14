export type TargetConfig = { qcLotId?: string; lot?: string; meanSdHistory?: unknown[]; mean?: unknown; sd?: unknown; low?: unknown; high?: unknown };
export type TargetRange = { mean: number|null; sd: number|null; low: number|null; high: number|null };
export type TargetConfigStateDeps = { targetFromLimits: (low: number|null, high: number|null) => { mean: number; sd: number }|null; limitsFromTarget: (mean: number|null, sd: number|null) => { low: number; high: number }|null };

export function targetConfigAssigned(config: TargetConfig|null|undefined) {
  return !!(config&&(config.qcLotId||config.lot||(Array.isArray(config.meanSdHistory)&&config.meanSdHistory.length)));
}

export function createTargetRangeDraft(deps: TargetConfigStateDeps) {
  return (config: TargetConfig={}) : TargetRange => {
    let mean=config.mean==null?null:Number(config.mean),sd=config.sd==null?null:Number(config.sd),low=config.low==null?null:Number(config.low),high=config.high==null?null:Number(config.high);
    const fromLimits=deps.targetFromLimits(low,high);
    if(fromLimits){if(!Number.isFinite(mean))mean=fromLimits.mean;if(sd==null||!Number.isFinite(sd)||sd<=0)sd=fromLimits.sd;}
    const fromTarget=deps.limitsFromTarget(mean,sd);
    if(fromTarget){if(!Number.isFinite(low))low=fromTarget.low;if(!Number.isFinite(high))high=fromTarget.high;}
    return {mean,sd,low,high};
  };
}
