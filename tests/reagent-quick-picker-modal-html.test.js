'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-quick-picker-modal-html.ts');
const program = `import { reagentQuickPickerModalHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentQuickPickerModalHtml({labelHtml:'Người thực hiện',rowsHtml:'<div class="mrow">Nguyễn A</div>',placeholderHtml:'Người thực hiện',addButtonHtml:'<button>Thêm</button>',closeButtonHtml:'<button>Đóng</button>'}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<h3>Chọn nhanh Người thực hiện<\/h3>/, 'Tiêu đề phải giữ nhãn được dựng sẵn');
assert.match(html, /<div class="mrow">Nguyễn A<\/div>/, 'Các dòng chọn nhanh phải được giữ nguyên');
assert.match(html, /id="rcQuickNew"/, 'Ô thêm nhanh phải giữ ID để focus');
assert.match(html, /placeholder="Thêm Người thực hiện mới"/, 'Placeholder phải nhận nhãn đã escape');
assert.match(html, /data-keydown-action="rcAddQuick" data-keydown-keys='\["Enter"\]'/, 'Phím Enter phải thêm mục nhanh');
assert.match(html, /<button>Thêm<\/button>/, 'Nút thêm phải được ghép vào modal');
assert.match(html, /<button>Đóng<\/button>/, 'Nút đóng phải được ghép vào modal');

console.log('Reagent quick picker modal HTML tests passed');
