'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const source = pathToFileURL(path.join(__dirname, '..', 'src', 'domain', 'reagent', 'reagent-pairs.ts')).href;
const program = `
  import { reagentPairMath } from ${JSON.stringify(source)};
  console.log(JSON.stringify({
    valid: reagentPairMath.validPairs([['10.5', '11'], ['x', '12'], [3, 4], null]),
    calc: reagentPairMath.pairCalc(['10.5', '11']), invalid: reagentPairMath.pairCalc(['x', '11']), empty: reagentPairMath.validPairs(null),
  }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], {
  cwd: path.join(__dirname, '..'), encoding: 'utf8',
});
assert.equal(result.status, 0, result.stderr || 'khong the chay mo-dun TypeScript cap so lieu hoa chat');
const output = JSON.parse(result.stdout);
assert.deepEqual(output.valid, { o: [10.5, 3], n: [11, 4] });
assert.deepEqual(output.calc, { avg: 10.75, dif: -0.5 });
assert.equal(output.invalid, null);
assert.deepEqual(output.empty, { o: [], n: [] });

console.log('Reagent pairs TypeScript tests passed');
