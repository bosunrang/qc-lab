'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'reagent', 'reagent-comparison-calculation.ts')).href;
const program = `
  import { createReagentComparisonCalculator } from ${JSON.stringify(source)};
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values => { const m = mean(values); return values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1); };
  const c = createReagentComparisonCalculator({
    validPairs: rows => { const o = [], n = []; (rows || []).forEach(row => { const a = Number(row?.[0]), b = Number(row?.[1]); if (Number.isFinite(a) && Number.isFinite(b)) { o.push(a); n.push(b); } }); return { o, n }; },
    mean, variance, max: values => Math.max(...values), min: values => Math.min(...values), pearson: () => 1,
    ols: () => ({ a: 0, b: 1, r2: 1 }), passingBablok: () => ({ a: 0, b: 1 }), twoSidedPValue: () => 0.7, tCritical: () => 2,
  });
  const rows = Array.from({ length: 20 }, (_, index) => [10 + index, (10 + index) * 1.01]);
  const pass = c.calculate({ rows, test: { coverageConfirmed: true, biasTarget: 6, alpha: 0.05 } }, 5);
  const short = c.calculate({ rows: rows.slice(0, 4), test: {} }, 5);
  const failed = c.calculate({ rows: Array.from({ length: 20 }, () => [10, 13]), test: { coverageConfirmed: true, biasTarget: 6 } }, 5);
  console.log(JSON.stringify({ pass: { N: pass.N, level: pass.level, passScreen: pass.passScreen, bias: pass.bias, tc2: pass.tc2 }, short, failed: { level: failed.level, tStat: String(failed.tStat), p2: failed.p2 } }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript tinh so sanh hoa chat');
const output = JSON.parse(result.stdout);
assert.equal(output.pass.N, 20); assert.equal(output.pass.level, 'ok'); assert.equal(output.pass.passScreen, true); assert.ok(output.pass.bias < 6); assert.equal(output.pass.tc2, 2);
assert.equal(output.short, null); assert.equal(output.failed.level, 'no'); assert.equal(output.failed.tStat, '-Infinity'); assert.equal(output.failed.p2, 0);

console.log('Reagent comparison calculation TypeScript tests passed');
