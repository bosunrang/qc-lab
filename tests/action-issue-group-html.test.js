'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-issue-group-html.ts')).href;
const program = `
  import { createActionIssueGroupHtml } from ${JSON.stringify(source)};
  const render = createActionIssueGroupHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(render({ severity: 'rej', title: 'Glucose <máu>', date: '12/08/2026', count: 2, countLabel: 'vi phạm', itemsHtml: '<article>Điểm QC</article>' }));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action issue group HTML TypeScript');
assert.match(result.stdout, /issue-group rej/);
assert.match(result.stdout, /Glucose &lt;máu>/);
assert.match(result.stdout, /2 vi phạm/);
assert.match(result.stdout, /<article>Điểm QC<\/article>/);
console.log('Action issue group HTML TypeScript tests passed');
