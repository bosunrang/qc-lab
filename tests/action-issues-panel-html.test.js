'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-issues-panel-html.ts')).href;
const program = `
  import { actionIssuesPanelHtml } from ${JSON.stringify(source)};
  console.log(actionIssuesPanelHtml('<div class="issue-row">NCE-1</div>'));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action issues panel HTML TypeScript');
assert.match(result.stdout, /panel action-issues-panel/);
assert.match(result.stdout, /Sự cố cần xử lý/);
assert.match(result.stdout, /<div class="issue-row">NCE-1<\/div>/);
console.log('Action issues panel HTML TypeScript tests passed');
