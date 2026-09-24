import assert from 'node:assert/strict';
import { erf, normalCdf, dpmoFromSigma, sigmaMetric, uncertaintyBudget } from '../main/domain/sigma-metrics.ts';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
near(erf(0), 0); near(erf(1), 0.84270079); near(normalCdf(0), .5); near(dpmoFromSigma(6), 3.40080322);
const sigma = sigmaMetric(15, 2, 3); near(sigma.sigma, 13 / 3); assert.equal(sigmaMetric(15, 2, 0), null);
const budget = uncertaintyBudget({ cv: 3, bias: 1.2, uCref: .3, uCal: .5 }); near(budget.uc, Math.sqrt(9 + 1.53 + .25)); assert.equal(budget.complete, true);
assert.equal(uncertaintyBudget({ cv: 3, bias: 1.2, uCal: .5 }).complete, false);
console.log('app sigma-metrics tests passed');


