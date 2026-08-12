'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-selection.ts')).href;
const program = `
  import { targetSelection } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    targetSelection([{ id: 'P1' }, { id: 'P2' }], [{ id: 'G1', lots: [] }, { id: 'G2', lots: ['L1'] }, { id: 'G3', active: false, lots: ['L2'] }], 'missing', 'G1', group => group.lots),
    targetSelection([], [], 'P1', 'G1', () => []),
    targetSelection([{ id: 'P1' }], [{ id: 'G1', lots: ['L1'] }], 'P1', 'G1', group => group.lots),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target selection TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ panelId: 'P1', groupId: 'G2' }, { panelId: '', groupId: '' }, { panelId: 'P1', groupId: 'G1' }]);
console.log('Target selection TypeScript tests passed');
