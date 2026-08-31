// Oracle: xac nhan erf/normalCdf/dpmoFromSigma/sigmaMetric/uncertaintyBudget
// moi cho ket qua giong het ban cu (assets/core.js) tren nhieu input khac
// nhau - khong co import cheo giua cac file trong sigma-metrics.ts nen co
// the import thang .ts.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const QCCore = require('../../assets/core.js');
import { erf, normalCdf, dpmoFromSigma, sigmaMetric, uncertaintyBudget } from '../main/domain/sigma-metrics.ts';

for (const x of [-3, -1, -0.5, 0, 0.5, 1, 1.5, 2, 3, 5]) {
  assert.ok(Math.abs(erf(x) - QCCore.erf(x)) < 1e-12, `erf(${x}) lech ban cu`);
  assert.ok(Math.abs(normalCdf(x) - QCCore.normalCdf(x)) < 1e-12, `normalCdf(${x}) lech ban cu`);
}

for (const sigma of [1, 2, 3, 4, 5, 6, 7]) {
  assert.ok(Math.abs(dpmoFromSigma(sigma) - QCCore.dpmoFromSigma(sigma)) < 1e-9, `dpmoFromSigma(${sigma}) lech ban cu`);
}

const sigmaCases = [
  [15, 2, 3], [10, -1.5, 2], [0, 1, 2], [15, 2, 0], [15, 2, -1], [NaN, 2, 3],
];
for (const [tea, bias, cv] of sigmaCases) {
  const newR = sigmaMetric(tea, bias, cv);
  const oldR = QCCore.sigmaMetric(tea, bias, cv);
  assert.deepEqual(newR, oldR, `sigmaMetric(${tea},${bias},${cv}) lech ban cu`);
}

const muCases = [
  { cv: 3 },                                                  // chi co u(Rw), thieu bias+cal
  { cv: 3, bias: 1.2, biasRefU: 0.3, uCal: 0.5 },              // du 3 thanh phan
  { cv: 3, bias: 1.2, includeBias: false, uCal: 0.5 },         // tat nhanh bias
  { cv: 3, bias: 1.2, uCal: 0, target: 5, tea: 15 },           // uCal=0 hop le (khac null)
  { cv: 0 },                                                   // cv khong hop le -> null
  {},                                                           // khong co gi -> null
];
for (const input of muCases) {
  const newR = uncertaintyBudget(input);
  const oldR = QCCore.uncertaintyBudget(input);
  assert.deepEqual(newR, oldR, `uncertaintyBudget(${JSON.stringify(input)}) lech ban cu`);
}

console.log('app-v2 sigma-metrics oracle tests passed');
