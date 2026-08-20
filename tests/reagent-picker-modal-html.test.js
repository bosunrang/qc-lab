'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-picker-modal-html.ts');
const program = `import { reagentPickerModalHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentPickerModalHtml({searchValueHtml:'Glucose &amp; 1',rowsHtml:'<div class="mrow on">Glucose</div>',closeButtonHtml:'<button>Đóng</button>'}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<h3>Chọn phép so sánh<\/h3>/, 'Modal phải giữ tiêu đề chọn hồ sơ');
assert.match(html, /id="rcModalSearch"/, 'Ô tìm kiếm phải giữ ID để focus');
assert.match(html, /value="Glucose &amp; 1"/, 'Giá trị tìm kiếm đã escape phải được giữ nguyên');
assert.match(html, /data-action="rcModalSearchSet" data-action-on="input"/, 'Tìm kiếm phải gọi đúng handler');
assert.match(html, /<div class="mrow on">Glucose<\/div>/, 'Danh sách hồ sơ phải được ghép vào modal');
assert.match(html, /<button>Đóng<\/button>/, 'Nút đóng phải được ghép vào modal');

console.log('Reagent picker modal HTML tests passed');
