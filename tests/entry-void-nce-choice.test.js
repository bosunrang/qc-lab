'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-void-nce-choice.ts')).href;
const program = `
  import { entryVoidNceChoice, entryVoidReasonValid } from ${JSON.stringify(source)};
  console.log(JSON.stringify([entryVoidNceChoice('analytical'), entryVoidNceChoice('data-entry'), entryVoidNceChoice('other'), entryVoidReasonValid('other', 'abc'), entryVoidReasonValid('other', 'abcde'), entryVoidReasonValid('data-entry', '')]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry void NCE choice TypeScript');
const [analytical, dataEntry, other, shortReason, validReason, optionalReason] = JSON.parse(result.stdout);
assert.deepEqual([analytical.openNce, analytical.disabled], [true, true]);
assert.deepEqual([dataEntry.openNce, dataEntry.disabled], [false, true]);
assert.deepEqual([other.openNce, other.disabled], [false, false]);
assert.match(other.reasonLabel, /tối thiểu 5 ký tự/);
assert.deepEqual([shortReason, validReason, optionalReason], [false, true, true]);
console.log('Entry void NCE choice TypeScript tests passed');
