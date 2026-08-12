'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'manage-transition-status.ts')).href;
const program = `
  import { manageTransitionStatus } from ${JSON.stringify(source)};
  console.log(JSON.stringify(['active', 'accepted', 'rejected', 'planned'].map(manageTransitionStatus)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy manage transition status TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ text: 'Đang chạy song song', cls: 'warn' }, { text: 'Chấp nhận lô mới', cls: 'ok' }, { text: 'Không chấp nhận', cls: 'rej' }, { text: 'Dự kiến', cls: 'none' }]);
console.log('Manage transition status TypeScript tests passed');
