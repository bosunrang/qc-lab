'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-level-lots.ts')).href;
const program = `
  import { targetLevelLots } from ${JSON.stringify(source)};
  console.log(JSON.stringify(targetLevelLots([{ id: 'L1', level: 1 }, { id: 'L2', level: '2', depleted: true }, { id: 'L3', level: 2 }], '2')));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target level lots TypeScript');
assert.deepEqual(JSON.parse(result.stdout), { levelLots: [{ id: 'L2', level: '2', depleted: true }, { id: 'L3', level: 2 }], depletedLots: [{ id: 'L2', level: '2', depleted: true }] });
console.log('Target level lots TypeScript tests passed');
