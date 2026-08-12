'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-lot-group-labels.ts')).href;
const program = `
  import { manageLotGroupLabels } from ${JSON.stringify(source)};
  console.log(JSON.stringify([manageLotGroupLabels([{ name: 'A', lotIds: ['L1'] }, { name: 'B', lotIds: ['L1', 'L2'] }], 'L1'), manageLotGroupLabels([], 'L3')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage lot group labels TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['A, B', 'Chưa thuộc nhóm']);
console.log('Manage lot group labels TypeScript tests passed');
