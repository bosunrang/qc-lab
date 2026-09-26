// Bộ ca thẩm định (`app/validation/`) chạy như hồi quy: mọi ca phải khớp đáp
// án, và các đáp án số phải tái lập được bằng bộ tính tham chiếu độc lập —
// sai ở bước soạn ca bị bắt ở đây, không lọt vào biên bản thẩm định.
import assert from 'node:assert/strict';
import test from 'node:test';
import { runValidation } from '../validation/run-validation.mjs';
import { CUSUM_CASES, QGI_CASES, SIGMA_CASES, STATS_CASES } from '../validation/cases.mjs';
import * as ref from '../validation/reference.mjs';

const close = (a, b, tolerance = 5e-6) => (a == null || b == null ? a === b : Math.abs(a - b) <= tolerance);

test('mọi ca thẩm định khớp đáp án trên app thật', () => {
  const { results } = runValidation();
  const failed = results.filter((r) => !r.pass).map((r) => `${r.id}: ${r.checks.filter((c) => !c.pass).map((c) => `${c.check} (đáp án ${c.expected}, app ${c.actual})`).join('; ')}`);
  assert.deepEqual(failed, []);
  assert.ok(results.length >= 50, `đủ ca (${results.length})`);
});

test('đáp án thống kê tái lập được bằng bộ tính tham chiếu', () => {
  for (const item of STATS_CASES) {
    for (const [key, z] of Object.entries(item.expect.z || {})) {
      const [run, level] = key.split('/').map(Number);
      const target = item.levels.find((l) => l.level === level);
      assert.ok(close(ref.zScore(item.runs[run - 1].val[level], target.mean, target.sd), z), `${item.id} ${key}`);
    }
    for (const [level, want] of Object.entries(item.expect.stats || {})) {
      const rejectedRuns = new Set(Object.entries(item.expect.points || {}).filter(([, e]) => e.verdict === 'rej').map(([key]) => Number(key.split('/')[0])));
      const values = item.runs.map((run, index) => ({ run: index + 1, val: run.val[level] })).filter((row) => row.val != null && !rejectedRuns.has(row.run)).map((row) => row.val);
      assert.equal(values.length, want.n, `${item.id} mức ${level} n`);
      assert.ok(close(ref.mean(values), want.mean), `${item.id} mức ${level} Mean`);
      assert.ok(close(ref.sampleSd(values), want.sd), `${item.id} mức ${level} SD`);
      assert.ok(close(ref.cvPercent(values), want.cv), `${item.id} mức ${level} CV`);
    }
  }
});

test('đáp án Sigma, DPMO, Bias EQA và QGI tái lập được bằng bộ tính tham chiếu', () => {
  for (const item of SIGMA_CASES) {
    const want = item.expect[1];
    let bias, cv, tea;
    if (item.cohort) {
      const values = item.runs.map((run) => run.val[1]);
      ({ tea, biasEqa: bias } = item.cohort);
      cv = ref.cvPercent(values);
      assert.ok(close(cv, want.cv), `${item.id} CV`);
    } else {
      const level = item.sigma.levels[0];
      tea = item.sigma.tea; cv = level.cv;
      bias = level.eqaRounds ? ref.rms(level.eqaRounds.map((r) => ref.eqaBiasPercent(r.lab, r.target))) : level.biasEqa;
      if ('biasEqa' in want) assert.ok(close(bias, want.biasEqa), `${item.id} Bias RMS`);
    }
    if (want.sigma === null) { assert.equal(bias, undefined, `${item.id} không có Bias`); continue; }
    const sigma = ref.sigmaMetric(tea, bias, cv);
    assert.ok(close(sigma, want.sigma), `${item.id} Sigma ${sigma}`);
    if ('dpmo' in want) assert.ok(Math.abs(ref.dpmo(sigma) - want.dpmo) <= 0.01, `${item.id} DPMO ${ref.dpmo(sigma)}`);
  }
  for (const item of QGI_CASES) assert.ok(close(ref.qgi(item.bias, item.cv), item.expect.qgi), item.id);
});

test('đáp án CUSUM tái lập được bằng bộ tính tham chiếu', () => {
  for (const item of CUSUM_CASES) {
    const zs = [];
    const resets = new Set();
    for (const step of item.runs) {
      if (step.nceEffective) resets.add(zs.length);
      else zs.push(step.z[1]);
    }
    const rows = ref.tabularCusum(zs, item.cusum.k, item.cusum.h, resets);
    if (item.expect.cPos) assert.deepEqual(rows.map((r) => Number(r.cPos.toFixed(6))), item.expect.cPos, `${item.id} C+`);
    if (item.expect.cNeg) assert.deepEqual(rows.map((r) => Number(r.cNeg.toFixed(6))), item.expect.cNeg, `${item.id} C−`);
    assert.deepEqual(rows.flatMap((r, i) => (r.signal ? [i + 1] : [])), item.expect.signalRuns, `${item.id} tín hiệu`);
  }
});
