'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-reference-kind.ts')).href;
const program = `
  import { teaReferenceKind } from ${JSON.stringify(source)};
  console.log(JSON.stringify([teaReferenceKind(false, true, true), teaReferenceKind(true, true, true), teaReferenceKind(true, false, true), teaReferenceKind(true, false, false)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea reference kind TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['custom', 'override', 'lab', 'default']);
console.log('Tea reference kind TypeScript tests passed');
