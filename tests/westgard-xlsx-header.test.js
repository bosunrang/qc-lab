'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'westgard', 'westgard-xlsx-header.ts')).href;
const program = `
  import { createWestgardXlsxHeader } from ${JSON.stringify(source)};
  console.log(JSON.stringify(createWestgardXlsxHeader({ styles: { TITLE: 1, SUB: 2, LABEL: 4, VAL: 5 }, title: 'PHÂN TÍCH WESTGARD — Glucose', labName: 'PXN', department: 'Hóa sinh', address: '', exportedAt: '11/08/2026', exportedBy: 'KTV A', testName: 'Glucose', testUnit: 'mmol/L', machine: 'AU480', appName: 'QC Lab', appVersion: '2.7.6', withinRules: '1-3s', acrossRules: 'R4s' })));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy mô-đun TypeScript Westgard XLSX header');
const output = JSON.parse(result.stdout);
assert.equal(output.rows[3][2].v, 'Glucose · mmol/L');
assert.equal(output.rows[5][2].v, '1-3s');
assert.equal(output.rows[6][2].v, 'R4s');
assert.deepEqual(output.merges.slice(0, 2), ['A1:I1', 'A2:I2']);
console.log('Westgard XLSX header TypeScript tests passed');
