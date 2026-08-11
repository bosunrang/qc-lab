'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-multi-views.ts')).href;
const program = `
  import { createWestgardMultiViews } from ${JSON.stringify(source)};
  const compose = createWestgardMultiViews({ levels: () => [{ level: 1, lot: 'A' }, { level: 2, lot: 'B' }], points: (_test, level) => ['p' + level], previous: (_test, level) => 'old' + level, build: input => ({ levels: input.levels, previous: [...input.previousByLevel.entries()], open: input.openLevels }) });
  console.log(JSON.stringify(compose({ id: 'T1' }, new Set(['T1|2']))));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy westgard multi views TypeScript');
assert.deepEqual(JSON.parse(result.stdout), { levels: [{ level: 1, lot: 'A', pts: ['p1'] }, { level: 2, lot: 'B', pts: ['p2'] }], previous: [[1, 'old1'], [2, 'old2']], open: [2] });
console.log('Westgard multi views TypeScript tests passed');
