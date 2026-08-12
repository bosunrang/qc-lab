'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-side-chips-html.ts')).href;
const program = `
  import { createActionSideChipsHtml } from ${JSON.stringify(source)};
  console.log(createActionSideChipsHtml({ escape: value => String(value).replaceAll('<', '&lt;') })([{ cls: 'warn', label: '<Theo dõi>' }, { cls: 'ok', label: 'Đã chạy lại' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action side chips HTML TypeScript');
assert.equal(result.stdout.trim(), '<span class="action-chip warn">&lt;Theo dõi></span><span class="action-chip ok">Đã chạy lại</span>');
console.log('Action side chips HTML TypeScript tests passed');
