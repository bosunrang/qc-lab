'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-review-messages.ts')).href;
const program = `
  import { actionReviewMessages } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    actionReviewMessages.approval({ reason: 'protocol', missing: ['Nguyên nhân', 'Bằng chứng'] }, false),
    actionReviewMessages.approval({ reason: 'non-independent' }, true),
    actionReviewMessages.review('cancel', { reason: 'follow-up', action: { nceId: 'NCE-1' }, followUp: { nceId: 'NCE-2' } }, false),
    actionReviewMessages.review('return', { reason: 'cancelled' }, false),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action review messages TypeScript');
const output = JSON.parse(result.stdout);
assert.match(output[0], /Nguyên nhân, Bằng chứng/);
assert.match(output[1], /tài khoản này/);
assert.match(output[2], /NCE-1.*NCE-2/);
assert.match(output[3], /không thể trả lại/);
console.log('Action review messages TypeScript tests passed');
