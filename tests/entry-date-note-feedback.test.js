'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-date-note-feedback.ts')).href;
const program = `
  import { entryDateNoteFeedback, entryDateNoteErrorMessage } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entryDateNoteFeedback('ghi chú', '11/08/2026'), entryDateNoteFeedback('', '11/08/2026'), entryDateNoteErrorMessage('period-locked'), entryDateNoteErrorMessage('invalid-date')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry date note feedback TypeScript');
const [saved, removed, locked, other] = JSON.parse(result.stdout);
assert.match(saved.message, /Đã lưu/);
assert.match(removed.message, /Đã xóa/);
assert.equal(locked, 'Kỳ này đã chốt, không thể sửa ghi chú.');
assert.equal(other, '');
console.log('Entry date note feedback TypeScript tests passed');
