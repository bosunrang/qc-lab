'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'reagent', 'reagent-statistics.ts')).href;
const program = `
  import { reagentStatistics as s } from ${JSON.stringify(source)};
  const x = [1, 2, 3, 4], y = [2, 4, 6, 8];
  console.log(JSON.stringify({ max: s.max(x), min: s.min(x), mean: s.mean(x), variance: s.variance(x), pearson: s.pearson(x, y), ols: s.ols(x, y), medianOdd: s.median([3, 1, 2]), medianEven: s.median([4, 1, 3, 2]), pb: s.passingBablok(x, y), flat: s.passingBablok([1, 1], [2, 3]) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript thong ke hoa chat');
const output = JSON.parse(result.stdout);
assert.equal(output.max, 4); assert.equal(output.min, 1); assert.equal(output.mean, 2.5); assert.equal(output.variance, 5 / 3);
assert.equal(output.pearson, 1); assert.deepEqual(output.ols, { a: 0, b: 2, r2: 1 });
assert.equal(output.medianOdd, 2); assert.equal(output.medianEven, 2.5); assert.deepEqual(output.pb, { a: 0, b: 2 }); assert.deepEqual(output.flat, { a: 0, b: 1 });

console.log('Reagent statistics TypeScript tests passed');
