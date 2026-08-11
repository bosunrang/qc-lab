export function reagentMax(values: readonly number[]): number | undefined { return values.reduce((max, value) => value > max ? value : max, values[0]); }
export function reagentMin(values: readonly number[]): number | undefined { return values.reduce((min, value) => value < min ? value : min, values[0]); }
export function reagentMean(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
export function reagentVariance(values: readonly number[]): number {
  const mean = reagentMean(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}
export function reagentPearson(x: readonly number[], y: readonly number[]): number {
  const count = x.length; let sx = 0, sy = 0, sxy = 0, sx2 = 0, sy2 = 0;
  for (let index = 0; index < count; index++) { sx += x[index]; sy += y[index]; sxy += x[index] * y[index]; sx2 += x[index] * x[index]; sy2 += y[index] * y[index]; }
  const denominator = Math.sqrt((count * sx2 - sx * sx) * (count * sy2 - sy * sy));
  return denominator === 0 ? 0 : (count * sxy - sx * sy) / denominator;
}
export function reagentOls(x: readonly number[], y: readonly number[]) {
  const count = x.length, meanX = reagentMean(x), meanY = reagentMean(y); let sumXY = 0, sumXX = 0;
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
  for (let left = 0; left < count; left++) for (let right = left + 1; right < count; right++) {
    const dx = x[right] - x[left], dy = y[right] - y[left];
    if (dx === 0) continue;
    const slope = dy / dx;
    if (slope !== -1) slopes.push(slope);
  }
  if (!slopes.length) return { a: 0, b: 1 };
  slopes.sort((left, right) => left - right);
  const k = slopes.filter(slope => slope < -1).length, countSlopes = slopes.length;
  const b = countSlopes % 2 ? slopes[(countSlopes + 1) / 2 - 1 + k] : (slopes[countSlopes / 2 - 1 + k] + slopes[countSlopes / 2 + k]) / 2;
  return { a: reagentMedian(x.map((value, index) => y[index] - b * value)), b };
}

export const reagentStatistics = Object.freeze({ max: reagentMax, min: reagentMin, mean: reagentMean, variance: reagentVariance, pearson: reagentPearson, ols: reagentOls, median: reagentMedian, passingBablok: reagentPassingBablok });
