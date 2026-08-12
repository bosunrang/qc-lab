'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-group-label.ts')).href;
const program = `
  import { targetGroupLabel } from ${JSON.stringify(source)};
  console.log(JSON.stringify([targetGroupLabel({ name: 'Nhóm 1101/1102' }), targetGroupLabel()]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target group label TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Nhóm 1101/1102', 'Chưa chọn nhóm lô']);
console.log('Target group label TypeScript tests passed');
