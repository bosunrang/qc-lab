'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-charts-panel-html.ts');
const program = `import { reagentChartsPanelHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentChartsPanelHtml());`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<h2 class="panel-title">Biểu đồ<\/h2>/);
assert.match(html, /id="rcScatter"/, 'Biểu đồ tương quan phải giữ mount point');
assert.match(html, /id="rcBland"/, 'Biểu đồ Bland-Altman phải giữ mount point');
assert.match(html, /Đường hồi quy/);
assert.match(html, /±1\.96 SD/);

console.log('Reagent charts panel HTML tests passed');
