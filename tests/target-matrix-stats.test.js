'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-matrix-stats.ts')).href;
const program = `
  import { targetMatrixStats } from ${JSON.stringify(source)};
  console.log(JSON.stringify(targetMatrixStats([{ linked: { id: 'x' }, cfg: { mean: 1, sd: 0.1 } }, { assigned: true, cfg: { mean: 2, low: 1, high: 3 } }, { cfg: { mean: 3, sd: 0 } }, { cfg: { sd: 1 } }])));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target matrix stats TypeScript');
assert.deepEqual(JSON.parse(result.stdout), { linked: 1, other: 1, empty: 2, missing: 2 });
console.log('Target matrix stats TypeScript tests passed');
