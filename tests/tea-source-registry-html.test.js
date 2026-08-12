'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'manage', 'tea-source-registry-html.ts')).href;
const program = `
  import { createTeaSourceRegistryHtml } from ${JSON.stringify(source)};
  const render = createTeaSourceRegistryHtml({ escape: value => String(value).replaceAll('<', '&lt;'), escapeAttr: value => String(value).replaceAll('"', '&quot;') });
  console.log(render([{ status: 'dynamic', label: 'EFLM <BV>', statusLabel: 'Cập nhật liên tục', tagClass: 'ok', version: '2026', effectiveDate: '01/01/2026', reviewedDate: '12/08/2026', url: 'https://x.test/?q="a"' }]));
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || 'không thể chạy tea source registry HTML TypeScript');
assert.match(result.stdout, /EFLM &lt;BV>/);
assert.match(result.stdout, /hiệu lực 01\/01\/2026/);
assert.match(result.stdout, /href="https:\/\/x.test\/\?q=&quot;a&quot;"/);
console.log('Tea source registry HTML TypeScript tests passed');
