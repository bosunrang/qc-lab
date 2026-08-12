'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-lot-label.ts')).href;
const program = `
  import { manageLotLabel } from ${JSON.stringify(source)};
  console.log(JSON.stringify([manageLotLabel([{ id: 'L1', lotNo: '1101', level: 2 }], 'L1'), manageLotLabel([], 'L2')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage lot label TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['1101 · Mức 2', 'Chưa chọn lô']);
console.log('Manage lot label TypeScript tests passed');
