// Thong ke so sanh lo hoa chat (reagent lot comparison): paired t-test,
// hoi quy OLS + Passing-Bablok, cong "dat sang loc phan mem" (rcCalc cu).
// Day la quyet dinh lam sang thuc su (lo hoa chat moi co duoc dung tren mau
// benh nhan khong) - port gan nguyen van tu src/domain/reagent/*.ts cu, xac
// nhan bang oracle test doi chieu voi rcCalc/rcReportSummaryTable cua ban cu.

export const RC_MIN_PAIRS = 5;

export function reagentMax(values: readonly number[]): number | undefined {
  return values.reduce((max, value) => (value > max ? value : max), values[0]);
}
export function reagentMin(values: readonly number[]): number | undefined {
  return values.reduce((min, value) => (value < min ? value : min), values[0]);
}
export function reagentMean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
export function reagentVariance(values: readonly number[]): number {
  const mean = reagentMean(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}
export function reagentPearson(x: readonly number[], y: readonly number[]): number {
  const count = x.length;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let index = 0; index < count; index++) {
    sx += x[index]; sy += y[index]; sxy += x[index] * y[index]; sx2 += x[index] * x[index]; sy2 += y[index] * y[index];
  }
  const denominator = Math.sqrt((count * sx2 - sx * sx) * (count * sy2 - sy * sy));
  return denominator === 0 ? 0 : (count * sxy - sx * sy) / denominator;
}
export function reagentOls(x: readonly number[], y: readonly number[]) {
  const count = x.length, meanX = reagentMean(x), meanY = reagentMean(y);
  let sumXY = 0, sumXX = 0;
  for (let index = 0; index < count; index++) { sumXY += (x[index] - meanX) * (y[index] - meanY); sumXX += (x[index] - meanX) ** 2; }
  const b = sumXX === 0 ? 0 : sumXY / sumXX, a = meanY - b * meanX, r = reagentPearson(x, y);
  return { a, b, r2: r * r };
}
export function reagentMedian(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right), count = sorted.length;
  return count % 2 ? sorted[(count - 1) / 2] : (sorted[count / 2 - 1] + sorted[count / 2]) / 2;
}
export function reagentPassingBablok(x: readonly number[], y: readonly number[]) {
  const slopes: number[] = [], count = x.length;
  for (let left = 0; left < count; left++) {
    for (let right = left + 1; right < count; right++) {
      const dx = x[right] - x[left], dy = y[right] - y[left];
      if (dx === 0) continue;
      const slope = dy / dx;
      if (slope !== -1) slopes.push(slope);
    }
  }
  if (!slopes.length) return { a: 0, b: 1 };
  slopes.sort((left, right) => left - right);
  const k = slopes.filter(slope => slope < -1).length, countSlopes = slopes.length;
  const b = countSlopes % 2
    ? slopes[(countSlopes + 1) / 2 - 1 + k]
    : (slopes[countSlopes / 2 - 1 + k] + slopes[countSlopes / 2 + k]) / 2;
  return { a: reagentMedian(x.map((value, index) => y[index] - b * value)), b };
}

export function reagentLogGamma(value: number): number {
  const coefficients = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = value, x = value + 5.5;
  x -= (value + 0.5) * Math.log(x);
  let sum = 1.000000000190015;
  for (let index = 0; index < 6; index++) { y++; sum += coefficients[index] / y; }
  return -x + Math.log((2.5066282746310005 * sum) / value);
}
export function reagentBetaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200, epsilon = 3e-12, floor = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d;
  let h = d;
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const twice = 2 * iteration;
    let aa = (iteration * (b - iteration) * x) / ((qam + twice) * (a + twice));
    d = 1 + aa * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d; h *= d * c;
    aa = (-(a + iteration) * (qab + iteration) * x) / ((a + twice) * (qap + twice));
    d = 1 + aa * d; if (Math.abs(d) < floor) d = floor;
    c = 1 + aa / c; if (Math.abs(c) < floor) c = floor;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}
export function reagentRegularizedBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(reagentLogGamma(a + b) - reagentLogGamma(a) - reagentLogGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (factor * reagentBetaContinuedFraction(a, b, x)) / a
    : 1 - (factor * reagentBetaContinuedFraction(b, a, 1 - x)) / b;
}
export function reagentTwoSidedPValue(t: number, degreesOfFreedom: number): number {
  return reagentRegularizedBeta(degreesOfFreedom / 2, 0.5, degreesOfFreedom / (degreesOfFreedom + t * t));
}
export function reagentTCritical(degreesOfFreedom: number, alpha: number): number {
  let low = 0, high = 1000;
  for (let iteration = 0; iteration < 200; iteration++) {
    const middle = (low + high) / 2;
    if (reagentTwoSidedPValue(middle, degreesOfFreedom) > alpha) low = middle; else high = middle;
  }
  return (low + high) / 2;
}

export function reagentValidPairs(rows: readonly (readonly unknown[] | null | undefined)[] | null | undefined) {
  const o: number[] = [], n: number[] = [];
  (rows || []).forEach(row => {
    const oldValue = Number.parseFloat(String(row?.[0] ?? '')), newValue = Number.parseFloat(String(row?.[1] ?? ''));
    if (!Number.isNaN(oldValue) && !Number.isNaN(newValue)) { o.push(oldValue); n.push(newValue); }
  });
  return { o, n };
}

export type ReagentComparisonDataset = {
  rows?: readonly (readonly unknown[] | null | undefined)[] | null;
  test?: { biasTarget?: unknown; alpha?: unknown; coverageConfirmed?: unknown } | null;
};

export function calculateReagentComparison(dataset: ReagentComparisonDataset | null | undefined, minimumPairs: number = RC_MIN_PAIRS) {
  const { o, n } = reagentValidPairs(dataset?.rows);
  if (o.length < minimumPairs) return null;
  const test = dataset?.test || {};
  const N = o.length, df = N - 1, d = o.map((value, index) => value - n[index]);
  const mO = reagentMean(o), mN = reagentMean(n), vO = reagentVariance(o), vN = reagentVariance(n);
  const md = reagentMean(d), sdd = Math.sqrt(reagentVariance(d));
  const dRange = reagentMax(d)! - reagentMin(d)!;
  const degenerate = dRange < 1e-9 * (Math.abs(mO) + Math.abs(mN) + 1);
  const tStat = degenerate ? (md === 0 ? 0 : md > 0 ? Infinity : -Infinity) : md / (sdd / Math.sqrt(N));
  const r = reagentPearson(o, n);
  const alpha = Number.parseFloat(String(test.alpha ?? '')) || 0.05;
  const p2 = Number.isFinite(tStat) ? reagentTwoSidedPValue(tStat, df) : 0;
  const bias = mO ? Math.abs((mO - mN) / Math.abs(mO)) * 100 : mN ? Infinity : 0;
  const biasT = Number.parseFloat(String(test.biasTarget ?? '')) || 6;
  const coverage = !!test.coverageConfirmed, enoughN = N >= 20;
  const fit = reagentOls(o, n), pb = reagentPassingBablok(o, n);
  const relPairs = o
    .map((value, index) => { const midpoint = (value + n[index]) / 2; return midpoint !== 0 ? Math.abs((value - n[index]) / midpoint) : null; })
    .filter((value): value is number => value != null);
  const mard = relPairs.length ? reagentMean(relPairs) * 100 : NaN;
  const passP = p2 > alpha, passBias = bias < biasT, passR2 = fit.r2 > 0.95, passSlope = fit.b >= 0.9 && fit.b <= 1.1;
  const passScreen = enoughN && coverage && passBias;
  const level: 'ok' | 'mid' | 'no' = !passBias ? 'no' : passScreen ? 'ok' : 'mid';
  return {
    o, n, N, df, d, mO, mN, vO, vN, md, sdd, tStat, r, alpha, p2, p1: p2 / 2,
    tc2: reagentTCritical(df, alpha), tc1: reagentTCritical(df, 2 * alpha),
    bias, biasT, fit, pb, mard, passP, passBias, passR2, passSlope, coverage, enoughN, passScreen, level,
  };
}
export type ReagentComparisonResult = ReturnType<typeof calculateReagentComparison>;
