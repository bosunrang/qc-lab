'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'entry', 'entry-save-feedback.ts')).href;
const program = `
  import { entrySaveFeedback } from ${JSON.stringify(source)};
  console.log(JSON.stringify([
    entrySaveFeedback({ level: 1, verdict: 'ok', dateText: '11/08/2026' }),
    entrySaveFeedback({ level: 2, lotNo: 'LOT-B', parallel: true, verdict: 'warn', rules: ['1-2s'], dateText: '11/08/2026' }),
    entrySaveFeedback({ level: 1, verdict: 'rej', rules: ['2-2s', 'R4s'], dateText: '11/08/2026' }),
  ]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy entry save feedback TypeScript');
const [ok, warn, rej] = JSON.parse(result.stdout);
assert.deepEqual([ok.cls, ok.emphasis], ['ok', false]);
assert.match(ok.message, /Đã lưu Mức 1/);
assert.match(warn.message, /lô song song LOT-B.*1-2s/);
assert.deepEqual([rej.cls, rej.emphasis], ['rej', true]);
assert.match(rej.message, /2-2s, R4s/);
console.log('Entry save feedback TypeScript tests passed');
