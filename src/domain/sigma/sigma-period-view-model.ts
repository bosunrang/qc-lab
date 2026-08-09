type Value = Record<string, any>;

export type SigmaPeriodViewModelDeps = {
  sigmaMetric: (tea: number, bias: number, cv: number) => { sigma: number; dpmo: number; yieldPercent: number } | null;
  teaFor: (test: Value, entry: Value, level: number, refs: unknown) => number;
  teaMeta: (test: Value, source: string) => Value;
  teaSource: (test: Value) => string;
  teaLabel: (source: string) => string;
  teaReference: (test: Value) => string;
  readiness: (level: Value) => Value;
  muFor: (test: Value, entry: Value, level: number, tea: number, refs: unknown) => unknown;
  zone: (sigma: number) => Value;
  runPlan: (sigma: number) => Value | null;
};

export function createSigmaPeriodViewModel(deps: SigmaPeriodViewModelDeps) {
  const comp = (test: Value, entry: Value, level: number, refs: unknown) => {
    const data = (entry.lv && entry.lv[level]) || {}, cv = Number.parseFloat(data.cv), bias = Number.parseFloat(data.biasEqa ?? data.bias);
    const tea = deps.teaFor(test, entry, level, refs), metric = deps.sigmaMetric(tea, bias, cv);
    if (!metric) return null;
    const { sigma, dpmo } = metric, ready = deps.readiness(data), zone = ready.classifiable ? deps.zone(sigma) : { c: '#6b756f', label: ready.label }, warnings: string[] = [];
    const source = entry.teaSource || deps.teaSource(test), meta = deps.teaMeta(test, source);
    if (Math.abs(bias) >= tea) warnings.push('|Bias| đã bằng hoặc vượt TEa');
    if (ready.status !== 'eligible') warnings.push(ready.label);
    return { cv, bias, biasMethod: data.biasEqaMethod || 'manual', biasLabel: data.biasEqaMethod === 'rms' ? 'Bias EQA/EQC (RMS)' : 'Bias EQA/EQC', tea,
      teaTarget: Number.isFinite(Number(data.teaTarget)) ? Number(data.teaTarget) : null, teaCriterionRule: data.teaCriterionRule || '', teaCriterionPercent: Number.isFinite(Number(data.teaCriterionPercent)) ? Number(data.teaCriterionPercent) : null, teaCriterionAbsolute: Number.isFinite(Number(data.teaCriterionAbsolute)) ? Number(data.teaCriterionAbsolute) : null, teaCriterionUnit: data.teaCriterionUnit || '',
      teaSource: source, teaLabel: entry.teaLabel || deps.teaLabel(deps.teaSource(test)), teaReference: entry.teaReference || deps.teaReference(test), teaSourceId: entry.teaSourceId || meta.id || '', teaSourceVersion: entry.teaSourceVersion || meta.version || '', teaSourceUrl: entry.teaSourceUrl || meta.url || '', teaEffectiveDate: entry.teaEffectiveDate || meta.effectiveDate || '', teaReviewedDate: entry.teaReviewedDate || meta.reviewedDate || '', teaReviewedBy: entry.teaReviewedBy || meta.reviewedBy || '',
      cvSource: data.cvSource || 'manual', n: Number.isFinite(Number(data.n)) ? Number(data.n) : null, sourceStart: data.sourceStart || '', sourceEnd: data.sourceEnd || '', sourceLot: data.sourceLot || '', cohortStatus: ready.status, classifiable: ready.classifiable, qcpEligible: ready.qcpEligible, readinessLabel: ready.label, warning: warnings.join(' · ') || null, mu: deps.muFor(test, entry, level, tea, refs), muBiasMode: data.muBiasMode === 'exclude' ? 'exclude' : 'include', uCalBasis: data.uCalBasis || '', muReviewedBy: data.muReviewedBy || '', muReviewedDate: data.muReviewedDate || '', sigma, dpmo, yld: metric.yieldPercent, dse: sigma - 1.65, run: ready.qcpEligible ? deps.runPlan(sigma) : null, ...zone };
  };
  const rows = (test: Value, data: Value[], levels: number[], refs: unknown) => (data || []).map(entry => ({ e: entry, rs: levels.map(level => comp(test, entry, level, refs)) })).sort((a, b) => String(a.e.period || '').localeCompare(String(b.e.period || '')));
  return Object.freeze({ comp, rows });
}

export type SigmaPeriodViewModel = ReturnType<typeof createSigmaPeriodViewModel>;
