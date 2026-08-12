'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-legacy-detail-html.ts')).href;
const program = `
  import { createActionLegacyDetailHtml } from ${JSON.stringify(source)};
  const render = createActionLegacyDetailHtml({ escape: value => String(value).replaceAll('<', '&lt;') });
  console.log(JSON.stringify([render({ action: 'Kiểm tra <máy>', owner: 'Lan', rerunLabel: 'Đạt', approvalLabel: 'Chờ duyệt' }), render({ action: '', owner: '', rerunLabel: '', approvalLabel: '—' })]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action legacy detail HTML TypeScript');
const [detail, empty] = JSON.parse(result.stdout);
assert.match(detail, /Kiểm tra &lt;máy>/);
assert.match(detail, /Lan · Đạt · Chờ duyệt/);
assert.match(empty, /<div>—<\/div>/);
assert.match(empty, /— · Chưa có dữ liệu · —/);
console.log('Action legacy detail HTML TypeScript tests passed');
