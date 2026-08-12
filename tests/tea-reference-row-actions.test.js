'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-reference-row-actions.ts')).href;
const program = `
  import { teaReferenceRowActions } from ${JSON.stringify(source)};
  console.log(JSON.stringify([teaReferenceRowActions('override', true, false), teaReferenceRowActions('custom', true, true), teaReferenceRowActions('lab', true, true), teaReferenceRowActions('default', false, false)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea reference row actions TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [{ action: 'restore', labProfile: 'add' }, { action: 'remove', labProfile: 'view' }, { action: 'none', labProfile: 'view' }, { action: 'none', labProfile: 'none' }]);
console.log('Tea reference row actions TypeScript tests passed');
