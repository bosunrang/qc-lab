// Oracle test: doi chieu app-v2/main/domain/reagent-stats.ts voi rcCalc cua
// ban cu (assets/core.js + generated/modular-pilot.js), dung lai chinh xac
// cac kich ban trong tests/reagent-stats.test.js cu.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const { loadSandbox, run } = require('../../tests/helpers/sandbox.js');
const { calculateReagentComparison } = require('../../app-v2-dist/main/domain/reagent-stats.js');

const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
run(ctx, 'function esc(s){return s==null?"":String(s);} function escAttr(s){return esc(s);}');

function makeDs(rows, testOverrides = {}) {
  return { id: 'd1', test: Object.assign({ reagent: 'X', lotOld: 'A', lotNew: 'B', biasTarget: 6, alpha: 0.05, coverageConfirmed: false }, testOverrides), rows };
}
const close = (actual, expected, epsilon = 1e-9, message = '') => assert.ok(Math.abs(actual - expected) <= epsilon, message || `${actual} != ${expected} (within ${epsilon})`);

function compare(rows, overrides = {}) {
  const ds = makeDs(rows, overrides);
  const old = ctx.rcCalc(ds);
  const neu = calculateReagentComparison(ds, 5);
  if (old === null) { assert.equal(neu, null, 'ca hai phai cung tra null'); return null; }
  assert.notEqual(neu, null, 'ban moi khong duoc tra null khi ban cu co ket qua');
  for (const key of ['N', 'df', 'passBias', 'passScreen', 'level', 'enoughN', 'coverage', 'tStat']) {
    assert.equal(neu[key], old[key], `truong ${key} phai khop: moi=${neu[key]} cu=${old[key]}`);
  }
  close(neu.bias, old.bias, 1e-9, 'bias phai khop');
  close(neu.fit.b, old.fit.b, 1e-9, 'fit.b phai khop');
  close(neu.fit.r2, old.fit.r2, 1e-9, 'fit.r2 phai khop');
  close(neu.pb.b, old.pb.b, 1e-9, 'pb.b phai khop');
  close(neu.p2, old.p2, 1e-9, 'p2 phai khop');
  return neu;
}

// Case 1: bias 1%, du 20 cap, coverage confirmed -> pass
{
  const oldVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105];
  const rows = oldVals.map(v => [v, v * 1.01]);
  const R = compare(rows, { coverageConfirmed: true });
  assert.equal(R.N, 20);
  close(R.bias, 1, 1e-6);
  assert.equal(R.passScreen, true);
}

// Case 2: duoi RC_MIN_PAIRS (5) cap hop le -> null
{
  const rows = [[10, 10], [20, 'not-a-number'], [30, 30]];
  compare(rows);
}

// Case 3: bias qua lon -> fail bat ke gi khac
{
  const oldVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105];
  const rows = oldVals.map(v => [v, v * 1.5]);
  const R = compare(rows, { coverageConfirmed: true });
  close(R.bias, 50, 1e-6);
  assert.equal(R.level, 'no');
}

// Case 4: gia tri giong het nhau -> tStat=0 khong NaN/Infinity, chua du n
{
  const vals = [10, 20, 30, 40, 50, 60];
  const rows = vals.map(v => [v, v]);
  const R = compare(rows);
  assert.equal(R.tStat, 0);
  assert.equal(R.enoughN, false);
  assert.equal(R.level, 'mid');
}

// Case 5: thang do am van bao %bias duong
{
  const oldVals = [-10, -20, -30, -40, -50, -60];
  const rows = oldVals.map(v => [v, v * 1.1]);
  const R = compare(rows);
  close(R.bias, 10, 1e-6);
}

console.log('app-v2 reagent-stats oracle tests passed');
