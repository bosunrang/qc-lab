'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-lock-picker.ts')).href;
const program = `
  import { reportLockPicker } from ${JSON.stringify(source)};
  console.log(JSON.stringify([reportLockPicker('2026-08', 2026), reportLockPicker('bad', 2026), reportLockPicker('2025-13', 2026)]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy report lock picker TypeScript');
const [valid, missing, invalidMonth] = JSON.parse(result.stdout);
assert.deepEqual(valid, { year: 2026, month: 8, months: [1,2,3,4,5,6,7,8,9,10,11,12], years: [2023,2024,2025,2026,2027] });
assert.equal(missing.year, 2026);
assert.equal(missing.month, 1);
assert.equal(invalidMonth.year, 2025);
assert.equal(invalidMonth.month, 1);
console.log('Report lock picker TypeScript tests passed');
