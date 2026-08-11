'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'reagent', 'reagent-t-distribution.ts')).href;
const program = `
  import { reagentTDistribution as t } from ${JSON.stringify(source)};
  console.log(JSON.stringify({ beta0: t.regularizedBeta(2, 3, 0), beta1: t.regularizedBeta(2, 3, 1), p0: t.twoSidedPValue(0, 10), p2: t.twoSidedPValue(2.228139, 10), critical: t.tCritical(10, 0.05) }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript phan phoi t hoa chat');
const output = JSON.parse(result.stdout);
assert.equal(output.beta0, 0); assert.equal(output.beta1, 1); assert.equal(output.p0, 1);
assert.ok(Math.abs(output.p2 - 0.05) < 0.00001, `p-value sai: ${output.p2}`);
assert.ok(Math.abs(output.critical - 2.228139) < 0.00001, `t tới hạn sai: ${output.critical}`);

console.log('Reagent t-distribution TypeScript tests passed');
