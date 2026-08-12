'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'lot-transition-target-number.ts')).href;
const program = `
  import { lotTransitionTargetNumber } from ${JSON.stringify(source)};
  const transitions = [{ fromLotId: 'L1', toLotId: 'L2', active: false }, { fromLotId: 'L1', toLotId: 'L3', active: true }];
  console.log(JSON.stringify([lotTransitionTargetNumber(transitions, [{ id: 'L2', lotNo: 'OLD' }, { id: 'L3', lotNo: 'NEW' }], 'L1', transition => transition.active), lotTransitionTargetNumber(transitions, [], 'L1', transition => transition.active), lotTransitionTargetNumber(transitions, [], 'missing', () => true)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy lot transition target number TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['NEW', '', '']);
console.log('Lot transition target number TypeScript tests passed');
