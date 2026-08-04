/**
 * Tests for the reagent-lot comparison statistics (assets/modules/reagent.js):
 * paired t-test, OLS + Passing-Bablok regression, and the software "pass
 * screening" gate (rcCalc). This drives a real lab decision (whether a new
 * reagent lot may be used on patient samples), and previously had no
 * automated coverage.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/reagent-ui-state.js', 'modules/reagent.js']);
// esc()/escAttr() normally come from reports.js (not loaded here) — stub a plain
// passthrough since Case 6 below only checks for a literal template-placeholder bug,
// not HTML-escaping behavior.
run(ctx, 'function esc(s){return s==null?"":String(s);} function escAttr(s){return esc(s);}');

function makeDs(rows, testOverrides = {}) {
  return {
    id: 'd1',
    test: Object.assign(
      { reagent: 'X', lotOld: 'A', lotNew: 'B', biasTarget: 6, alpha: 0.05, coverageConfirmed: false },
      testOverrides,
    ),
    rows,
  };
}

const close = (actual, expected, epsilon = 1e-9, message = '') =>
  assert.ok(Math.abs(actual - expected) <= epsilon, message || `${actual} != ${expected} (within ${epsilon})`);

// --- Case 1: consistent 1% bias across 20 pairs, full coverage confirmed -> should pass screening ---
{
  const oldVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105];
  const rows = oldVals.map(v => [v, v * 1.01]);
  const R = ctx.rcCalc(makeDs(rows, { coverageConfirmed: true }));

  assert.equal(R.N, 20);
  close(R.bias, 1, 1e-6);
  assert.equal(R.enoughN, true);
  assert.equal(R.passBias, true, 'bias 1% must pass the default 6% target');
  assert.equal(R.passScreen, true, 'n>=20, coverage confirmed and bias within target must pass screening');
  assert.equal(R.level, 'ok');
  close(R.fit.b, 1.01, 1e-9);
  close(R.fit.r2, 1, 1e-9);
  close(R.pb.b, 1.01, 1e-9, 'Passing-Bablok slope should recover the exact multiplicative factor');
}

// --- Case 2: fewer than RC_MIN_PAIRS (5) valid numeric pairs -> no result at all ---
{
  const rows = [[10, 10], [20, 'not-a-number'], [30, 30]]; // only 2 valid pairs
  const R = ctx.rcCalc(makeDs(rows));
  assert.equal(R, null, 'must refuse to compute stats below the minimum pair count');
}

// --- Case 3: bias far outside the target -> fails regardless of everything else ---
{
  const oldVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 15, 25, 35, 45, 55, 65, 75, 85, 95, 105];
  const rows = oldVals.map(v => [v, v * 1.5]); // 50% bias
  const R = ctx.rcCalc(makeDs(rows, { coverageConfirmed: true }));
  close(R.bias, 50, 1e-6);
  assert.equal(R.passBias, false);
  assert.equal(R.level, 'no', 'a large bias must fail screening even with n>=20 and coverage confirmed');
}

// --- Case 4: numerical-stability guard - identical pairs (zero variance in the differences) ---
// rcCalc treats a near-zero spread in (old - new) as "degenerate" and short-circuits the
// t-statistic to avoid a 0/0 division, rather than producing NaN/Infinity.
{
  const vals = [10, 20, 30, 40, 50, 60];
  const rows = vals.map(v => [v, v]);
  const R = ctx.rcCalc(makeDs(rows));
  assert.equal(R.N, 6);
  assert.equal(R.tStat, 0, 'perfectly identical paired values must not produce NaN/Infinity from a 0/0 SD');
  assert.equal(R.bias, 0);
  assert.equal(R.enoughN, false, '6 pairs is below the 20-pair screening threshold');
  assert.equal(R.level, 'mid', 'bias within target but not enough pairs yet -> "chưa đủ điều kiện", not a pass or a fail');
}

// --- Case 5: negative-scale assays still report a positive absolute %bias ---
{
  const oldVals = [-10, -20, -30, -40, -50, -60];
  const rows = oldVals.map(v => [v, v * 1.1]);
  const R = ctx.rcCalc(makeDs(rows));
  close(R.bias, 10, 1e-6);
}

// --- Case 6: summary-table unit color must be interpolated, not printed as literal text ---
// The unit span was built with '...${RCC.muted}...' inside a SINGLE-quoted JS string
// concatenation instead of a template literal, so the placeholder was never evaluated —
// the printed/report summary table literally showed "color:${RCC.muted}" in the style
// attribute (harmless CSS-wise, since browsers just ignore the invalid value and fall
// back to inherited color, but the intended muted-gray unit text never appeared).
{
  const R = ctx.rcCalc(makeDs([[10, 10], [20, 20], [30, 30], [40, 40], [50, 50]]));
  const html = ctx.rcReportSummaryTable([{ ds: makeDs([], { reagent: 'Glucose', unit: 'mmol/L' }), R }]);
  assert.ok(!html.includes('${RCC.muted}'), 'unit color must be interpolated, not left as a literal template placeholder');
  const mutedColor = run(ctx, 'RCC.muted'); // top-level const in reagent.js isn't exposed as ctx.RCC
  assert.ok(html.includes(`color:${mutedColor}`), 'unit span must carry the real muted color value');
  assert.ok(html.includes('(mmol/L)'), 'unit text itself must still render');
}

console.log('Reagent comparison stats tests passed');
