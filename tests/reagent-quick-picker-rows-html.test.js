'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-quick-picker-rows-html.ts');
const program = `import { reagentQuickPickerRowsHtml } from ${JSON.stringify(pathToFileURL(source).href)}; const esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;'); console.log(JSON.stringify({rows:reagentQuickPickerRowsHtml({items:['<Nguyễn A>','B'],labelHtml:'người thực hiện',esc,selectButtonHtml:i=>'<button>Chọn '+i+'</button>'}),empty:reagentQuickPickerRowsHtml({items:[],labelHtml:'loại mẫu',esc,selectButtonHtml:()=>''})}));`;
const output = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' }));

assert.match(output.rows, /&lt;Nguyễn A&gt;/, 'Tên phải được escape');
assert.match(output.rows, /rcDelQuick\(0\)/);
assert.match(output.rows, /<button>Chọn 1<\/button>/);
assert.match(output.empty, /Chưa có loại mẫu trong danh sách/);

console.log('Reagent quick picker rows HTML tests passed');
