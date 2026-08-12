'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-search-values.ts')).href;
const program = `
  import { targetSearchValues } from ${JSON.stringify(source)};
  console.log(JSON.stringify(targetSearchValues({ name: 'Glucose', unit: 'mmol/L', method: 'Hexokinase', reagent: 'R1', section: 'Hóa sinh', instrumentId: 'I1', machine: 'cũ' }, 'Nhóm tháng 8', [{ lotNo: 'LOT-A' }, { lotNo: 'LOT-B' }], assay => assay.name + ' (GLU)', (id, fallback) => id === 'I1' ? 'AU680' : fallback || '')));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target search values TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Glucose', 'Glucose (GLU)', 'mmol/L', 'Hexokinase', 'R1', 'Hóa sinh', 'AU680', 'Nhóm tháng 8', 'LOT-A', 'LOT-B']);
console.log('Target search values TypeScript tests passed');
