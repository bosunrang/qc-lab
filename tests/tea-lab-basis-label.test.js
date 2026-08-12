'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-lab-basis-label.ts')).href;
const program = `
  import { teaLabBasisLabel } from ${JSON.stringify(source)};
  console.log(JSON.stringify([teaLabBasisLabel([['clia', 'CLIA 2024'], ['eflm', 'EFLM BV']], 'eflm'), teaLabBasisLabel([['clia', 'CLIA 2024']], 'other')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea lab basis label TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['EFLM BV', '']);
console.log('Tea lab basis label TypeScript tests passed');
