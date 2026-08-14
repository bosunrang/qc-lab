'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-report-detail-card-html.ts');
const program = `import { reagentReportDetailCardHtml, reagentReportChartGridHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(JSON.stringify({card:reagentReportDetailCardHtml({index:2,reagentHtml:'Glucose',pillHtml:'<span>Đạt</span>',bodyHtml:'<p>Chi tiết</p>',pagebreak:true}),charts:reagentReportChartGridHtml('<svg id="scatter"></svg>','<svg id="bland"></svg>')}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });
const output = JSON.parse(html);

assert.match(output.card, /style="break-before:page;"/);
assert.match(output.card, /<h3>2\. Glucose <span>Đạt<\/span><\/h3>/);
assert.match(output.card, /<div class="body"><p>Chi tiết<\/p><\/div>/);
assert.match(output.charts, /grid-template-columns:1fr 1fr/);
assert.match(output.charts, /id="scatter"/);
assert.match(output.charts, /id="bland"/);

const noBreakProgram = `import { reagentReportDetailCardHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentReportDetailCardHtml({index:1,reagentHtml:'A',pillHtml:'',bodyHtml:'',pagebreak:false}));`;
const noBreakHtml = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', noBreakProgram], { encoding: 'utf8' });
assert.match(noBreakHtml, /style=""/, 'Không pagebreak phải giữ style rỗng như layout cũ');

console.log('Reagent report detail card HTML tests passed');
