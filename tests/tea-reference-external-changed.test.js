'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-reference-external-changed.ts')).href;
const program = `
  import { teaReferenceExternalChanged } from ${JSON.stringify(source)};
  const base = ['Glucose', 'mmol/L', 10, 8, 'Hóa sinh'];
  console.log(JSON.stringify([teaReferenceExternalChanged({ unit: 'mmol/L', clia: 10, ricos: 8, section: 'Hóa sinh' }, base), teaReferenceExternalChanged({ unit: 'mg/dL', clia: 10, ricos: 8, section: 'Hóa sinh' }, base), teaReferenceExternalChanged({ unit: 'mmol/L', clia: 10, ricos: 8, section: 'Hóa sinh', cliaRule: 12 }, base), teaReferenceExternalChanged(undefined, base)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea reference external changed TypeScript');
assert.deepEqual(JSON.parse(result.stdout), [false, true, true, false]);
console.log('Tea reference external changed TypeScript tests passed');
