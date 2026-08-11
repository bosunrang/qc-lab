export function reagentLogGamma(value: number): number {
  const coefficients = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = value, x = value + 5.5; x -= (value + 0.5) * Math.log(x); let sum = 1.000000000190015;
  for (let index = 0; index < 6; index++) { y++; sum += coefficients[index] / y; }
  return -x + Math.log(2.5066282746310005 * sum / value);
}
export function reagentBetaContinuedFraction(a: number, b: number, x: number): number {
  const maxIterations = 200, epsilon = 3e-12, floor = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < floor) d = floor;
  d = 1 / d; let h = d;
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const twice = 2 * iteration;
    let aa = iteration * (b - iteration) * x / ((qam + twice) * (a + twice)); d = 1 + aa * d; if (Math.abs(d) < floor) d = floor; c = 1 + aa / c; if (Math.abs(c) < floor) c = floor; d = 1 / d; h *= d * c;
    aa = -(a + iteration) * (qab + iteration) * x / ((a + twice) * (qap + twice)); d = 1 + aa * d; if (Math.abs(d) < floor) d = floor; c = 1 + aa / c; if (Math.abs(c) < floor) c = floor; d = 1 / d;
    const delta = d * c; h *= delta; if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}
export function reagentRegularizedBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const factor = Math.exp(reagentLogGamma(a + b) - reagentLogGamma(a) - reagentLogGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? factor * reagentBetaContinuedFraction(a, b, x) / a : 1 - factor * reagentBetaContinuedFraction(b, a, 1 - x) / b;
}
export function reagentTwoSidedPValue(t: number, degreesOfFreedom: number): number { return reagentRegularizedBeta(degreesOfFreedom / 2, 0.5, degreesOfFreedom / (degreesOfFreedom + t * t)); }
export function reagentTCritical(degreesOfFreedom: number, alpha: number): number {
  let low = 0, high = 1000;
  for (let iteration = 0; iteration < 200; iteration++) { const middle = (low + high) / 2; if (reagentTwoSidedPValue(middle, degreesOfFreedom) > alpha) low = middle; else high = middle; }
  return (low + high) / 2;
}

export const reagentTDistribution = Object.freeze({ logGamma: reagentLogGamma, betaContinuedFraction: reagentBetaContinuedFraction, regularizedBeta: reagentRegularizedBeta, twoSidedPValue: reagentTwoSidedPValue, tCritical: reagentTCritical });
