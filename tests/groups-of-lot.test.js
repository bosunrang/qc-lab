'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'groups-of-lot.ts')).href;
const program = `
  import { groupsOfLot } from ${JSON.stringify(source)};
  console.log(JSON.stringify(groupsOfLot([{ id: 'G1', lotIds: ['L1'] }, { id: 'G2', lotIds: ['L2', 'L1'] }, { id: 'G3' }], 'L1').map(item => item.id)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy groups of lot TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['G1', 'G2']);
console.log('Groups of lot TypeScript tests passed');
