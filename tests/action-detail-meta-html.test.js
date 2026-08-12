'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'nce', 'action-detail-meta-html.ts')).href;
const program = `
  import { createActionDetailMetaHtml } from ${JSON.stringify(source)};
  console.log(createActionDetailMetaHtml({ escape: value => String(value).replaceAll('<', '&lt;') })([{ label: 'Xét nghiệm', value: 'Glucose <máu>', note: 'Lô A' }, { label: 'Mức', value: '1' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy action detail meta HTML TypeScript');
assert.match(result.stdout, /action-detail-meta/);
assert.match(result.stdout, /Glucose &lt;máu>/);
assert.match(result.stdout, /<small>Lô A<\/small>/);
assert.match(result.stdout, /<span>Mức<\/span><b>1<\/b>/);
console.log('Action detail meta HTML TypeScript tests passed');
