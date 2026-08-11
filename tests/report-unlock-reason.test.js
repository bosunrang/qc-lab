'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'report', 'report-unlock-reason.ts')).href;
const program = `
  import { createReportUnlockReason } from ${JSON.stringify(source)};
  const check = createReportUnlockReason({ clean: (value, max) => String(value || '').slice(0, max).replaceAll(/[^a-zA-Z ]/g, '') });
  console.log(JSON.stringify([check('  abc  '), check('  Bổ sung đối soát!  '), check('x'.repeat(1002))]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy report unlock reason TypeScript');
const [short, valid, bounded] = JSON.parse(result.stdout);
assert.deepEqual(short, { valid: false, reason: 'abc', error: 'Cần ghi lý do mở khóa tối thiểu 5 ký tự.' });
assert.deepEqual(valid, { valid: true, reason: 'B sung i sot', error: '' });
assert.equal(bounded.valid, true);
assert.equal(bounded.reason.length, 1000);
console.log('Report unlock reason TypeScript tests passed');
