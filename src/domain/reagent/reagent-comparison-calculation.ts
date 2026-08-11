export type ReagentComparisonDataset = { rows?: readonly (readonly unknown[] | null | undefined)[] | null; test?: Record<string, unknown> | null };
export type ReagentCalculationDeps = {
  validPairs: (rows: ReagentComparisonDataset['rows']) => { o: number[]; n: number[] };
  mean: (values: readonly number[]) => number; variance: (values: readonly number[]) => number;
  max: (values: readonly number[]) => number | undefined; min: (values: readonly number[]) => number | undefined;
  pearson: (x: readonly number[], y: readonly number[]) => number;
  ols: (x: readonly number[], y: readonly number[]) => { a: number; b: number; r2: number };
  passingBablok: (x: readonly number[], y: readonly number[]) => { a: number; b: number };
  twoSidedPValue: (t: number, degreesOfFreedom: number) => number;
  tCritical: (degreesOfFreedom: number, alpha: number) => number;
};

export function createReagentComparisonCalculator(deps: ReagentCalculationDeps) {
 const calculate = (dataset: ReagentComparisonDataset | null | undefined, minimumPairs: number) => {
  const { o, n } = deps.validPairs(dataset?.rows);
  if (o.length < minimumPairs) return null;
  const test = dataset?.test || {}, N = o.length, df = N - 1, d = o.map((value, index) => value - n[index]);
  const mO = deps.mean(o), mN = deps.mean(n), vO = deps.variance(o), vN = deps.variance(n), md = deps.mean(d), sdd = Math.sqrt(deps.variance(d));
  const dRange = deps.max(d)! - deps.min(d)!, degenerate = dRange < 1e-9 * (Math.abs(mO) + Math.abs(mN) + 1);
  const tStat = degenerate ? (md === 0 ? 0 : md > 0 ? Infinity : -Infinity) : md / (sdd / Math.sqrt(N)), r = deps.pearson(o, n);
  const alpha = Number.parseFloat(String(test.alpha ?? '')) || 0.05, p2 = Number.isFinite(tStat) ? deps.twoSidedPValue(tStat, df) : 0;
  const bias = mO ? Math.abs((mO - mN) / Math.abs(mO)) * 100 : mN ? Infinity : 0, biasT = Number.parseFloat(String(test.biasTarget ?? '')) || 6, coverage = !!test.coverageConfirmed, enoughN = N >= 20;
  const fit = deps.ols(o, n), pb = deps.passingBablok(o, n);
  const relPairs = o.map((value, index) => { const midpoint = (value + n[index]) / 2; return midpoint !== 0 ? Math.abs((value - n[index]) / midpoint) : null; }).filter((value): value is number => value != null);
  const mard = relPairs.length ? deps.mean(relPairs) * 100 : NaN;
  const passP = p2 > alpha, passBias = bias < biasT, passR2 = fit.r2 > 0.95, passSlope = fit.b >= 0.9 && fit.b <= 1.1;
  const passScreen = enoughN && coverage && passBias, level = !passBias ? 'no' : passScreen ? 'ok' : 'mid';
  return { o, n, N, df, d, mO, mN, vO, vN, md, sdd, tStat, r, alpha, p2, p1: p2 / 2, tc2: deps.tCritical(df, alpha), tc1: deps.tCritical(df, 2 * alpha), bias, biasT, fit, pb, mard, passP, passBias, passR2, passSlope, coverage, enoughN, passScreen, level };
 };
 return Object.freeze({ calculate });
}
