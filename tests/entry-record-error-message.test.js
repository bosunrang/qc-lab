'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-record-error-message.ts')).href;
const program = `
  import { entryRecordErrorMessage } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entryRecordErrorMessage('period-locked'), entryRecordErrorMessage('invalid-value')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry record error message TypeScript');
assert.deepEqual(JSON.parse(result.stdout), ['Kỳ này đã chốt, không thể nhập điểm QC.', 'Không thể lưu điểm QC không hợp lệ.']);
console.log('Entry record error message TypeScript tests passed');
