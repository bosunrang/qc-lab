'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'target-matrix-row-html.ts')).href;
const program = `
  import { targetMatrixRowHtml } from ${JSON.stringify(source)};
  const esc = value => String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
  console.log(targetMatrixRowHtml({ testId: 'T1', lotId: 'L1', locked: false, checked: true, disabled: false, name: 'Na <ion>', unit: 'mmol/L', mean: '140', low: '135', high: '145', sd: '2', status: 'other', otherLot: 'Lô & khác' }, esc, esc));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy target matrix row HTML TypeScript');
assert.match(result.stdout, /data-test="T1" data-lot="L1"/);
assert.match(result.stdout, /Na &lt;ion&gt;/);
assert.match(result.stdout, /Đang dùng Lô &amp; khác/);
assert.doesNotMatch(result.stdout, /target-row-locked/);
console.log('Target matrix row HTML TypeScript tests passed');
