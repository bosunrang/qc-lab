'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-reference-sort.ts')).href;
const program = `
  import { sortTeaReferences } from ${JSON.stringify(source)};
  console.log(JSON.stringify(sortTeaReferences([{ id: 'C', section: 'Hóa sinh', displayName: 'Ure' }, { id: 'B', section: 'Huyết học', displayName: 'RBC' }, { id: 'A', section: 'Hóa sinh', displayName: 'Glucose' }]).map(row => row.id)));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea reference sort TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['A', 'C', 'B']);
console.log('Tea reference sort TypeScript tests passed');
