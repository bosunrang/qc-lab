'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-row-state.ts')).href;
const program = `
  import { targetRowState } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetRowState({ id: 'x' }, false, false, false), targetRowState(null, true, false, false), targetRowState(null, false, true, false), targetRowState({ id: 'x' }, false, false, true)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target row state TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ locked: false, checked: true, disabled: false, status: 'linked' }, { locked: false, checked: false, disabled: true, status: 'other' }, { locked: false, checked: true, disabled: false, status: 'planned' }, { locked: true, checked: false, disabled: true, status: 'retired' }]);
console.log('Target row state TypeScript tests passed');
