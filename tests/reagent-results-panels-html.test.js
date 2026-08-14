'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-results-panels-html.ts');
const program = `import { reagentResultsPanelsHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentResultsPanelsHtml());`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<h2 class="panel-title">Kết quả thống kê<\/h2>/);
assert.match(html, /id="rcStats"/, 'Panel thống kê phải giữ mount point');
assert.match(html, /<h2 class="panel-title">Tiêu chí chấp nhận &amp; kết luận<\/h2>/);
assert.match(html, /id="rcCrit"/, 'Panel tiêu chí phải giữ mount point');
assert.match(html, /id="rcVerdict"/, 'Panel kết luận phải giữ mount point');

console.log('Reagent results panels HTML tests passed');
