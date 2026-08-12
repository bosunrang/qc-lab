'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-positive-number.ts')).href;
const program = `
  import { teaPositiveNumber } from ${JSON.stringify(source)};
  console.log(JSON.stringify([teaPositiveNumber(' 2.5 '), teaPositiveNumber(''), teaPositiveNumber('0'), teaPositiveNumber('-1'), teaPositiveNumber('abc'), teaPositiveNumber(Infinity)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea positive number TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [2.5, null, null, null, null, null]);
console.log('Tea positive number TypeScript tests passed');
