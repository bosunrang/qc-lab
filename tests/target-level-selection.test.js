'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-level-selection.ts')).href;
const program = `
  import { targetLevelSelection } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetLevelSelection([{ level: '3' }, { level: 1 }, { level: 3 }, { level: 'x' }], '3'), targetLevelSelection([{ level: 2 }], '9'), targetLevelSelection([], '1')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target level selection TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ levels: [1, 3], level: '3' }, { levels: [2], level: '2' }, { levels: [], level: '' }]);
console.log('Target level selection TypeScript tests passed');
