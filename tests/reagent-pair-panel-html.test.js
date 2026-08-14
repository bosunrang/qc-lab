'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-pair-panel-html.ts');
const program = `import { reagentPairPanelHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentPairPanelHtml({oldLotHeadHtml:'Lô cũ: A',newLotHeadHtml:'Lô mới: B',rowsHtml:'<div class="rc-pair-row">1</div>',actionsHtml:'<button>Thêm mẫu</button>',minPairs:5}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /id="rcOldLotHead">Lô cũ: A/);
assert.match(html, /id="rcNewLotHead">Lô mới: B/);
assert.match(html, /<div class="rc-pair-row">1<\/div>/);
assert.match(html, /rc-pair-actions/, 'Có thao tác ghi phải dựng vùng hành động');
assert.match(html, /Nhập tối thiểu 5 cặp/);

const readOnlyProgram = `import { reagentPairPanelHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentPairPanelHtml({oldLotHeadHtml:'',newLotHeadHtml:'',rowsHtml:'',actionsHtml:'',minPairs:5}));`;
const readOnlyHtml = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', readOnlyProgram], { encoding: 'utf8' });
assert.doesNotMatch(readOnlyHtml, /rc-pair-actions/, 'Chỉ đọc không dựng hành động thêm/xóa');

console.log('Reagent pair panel HTML tests passed');
