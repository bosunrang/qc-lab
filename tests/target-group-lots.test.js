'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-group-lots.ts')).href;
const program = `
  import { targetGroupLots } from ${JSON.stringify(source)};
  console.log(JSON.stringify(targetGroupLots([{ id: 'L1', lotNo: '1102', level: 2 }, { id: 'L2', lotNo: '1101', level: 2 }, { id: 'L3', lotNo: '1001', level: 1 }], { lotIds: ['L1', 'L3', 'L2'] }).map(item => item.id)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target group lots TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['L3', 'L2', 'L1']);
console.log('Target group lots TypeScript tests passed');
