'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-info-panel-html.ts');
const input = { disabledAttr: '', reagentValueHtml: 'Glucose', unitValueHtml: 'mmol/L', lotOldValueHtml: 'A', lotNewValueHtml: 'B', dateInputHtml: '<input id="rcDate">', operatorValueHtml: 'Nguyễn A', sampleTypeValueHtml: 'Huyết thanh', biasTarget: 6, alpha: 0.05, coverageChecked: true, canWrite: true, userIconHtml: '<svg>U</svg>', sampleIconHtml: '<svg>S</svg>' };
const program = `import { reagentInfoPanelHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentInfoPanelHtml(${JSON.stringify(input)}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<h2 class="panel-title">Thông tin đánh giá<\/h2>/);
assert.match(html, /value="Glucose" oninput="rcMeta\('reagent',this\.value\)"/);
assert.match(html, /id="rcDate"/, 'Ô ngày phải được ghép vào panel');
assert.match(html, /onclick="rcOpenQuick\('operator'\)"/);
assert.match(html, /onclick="rcOpenQuick\('sampleType'\)"/);
assert.match(html, /type="checkbox" checked/);

const readOnly = { ...input, disabledAttr: 'disabled', canWrite: false, coverageChecked: false };
const readOnlyProgram = `import { reagentInfoPanelHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentInfoPanelHtml(${JSON.stringify(readOnly)}));`;
const readOnlyHtml = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', readOnlyProgram], { encoding: 'utf8' });
assert.match(readOnlyHtml, /class="rc-icon-btn" disabled/, 'Chỉ đọc phải khóa chọn nhanh');
assert.match(readOnlyHtml, /<input disabled value="Glucose"/, 'Chỉ đọc phải khóa trường text');

console.log('Reagent info panel HTML tests passed');
