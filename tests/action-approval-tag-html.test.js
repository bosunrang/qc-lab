'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-approval-tag-html.ts')).href;
const program = `
  import { createActionApprovalTagHtml } from ${JSON.stringify(source)};
  console.log(createActionApprovalTagHtml({ escape: value => String(value).replaceAll('<', '&lt;') })({ cls: 'ok' }, 'Đã <duyệt>'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action approval tag HTML TypeScript');
assert.equal(result.stdout.trim(), '<span class="tag ok">Đã &lt;duyệt></span>');
console.log('Action approval tag HTML TypeScript tests passed');
