'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-create-modal-html.ts');
const program = `import { reagentCreateModalHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentCreateModalHtml({searchValueHtml:'Glucose &amp; 1',createTypedHtml:'<button>Tạo</button>',referenceRowsHtml:'<button class="refrow">Glucose</button>',emptyReferenceHtml:'<div class="empty">Trống</div>',closeButtonHtml:'<button>Đóng</button>'}));`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<h3>Thêm hóa chất<\/h3>/, 'Modal phải giữ tiêu đề tạo hóa chất');
assert.match(html, /id="rcCreateSearch"/, 'Ô tìm kiếm phải giữ ID để focus');
assert.match(html, /value="Glucose &amp; 1"/, 'Giá trị tìm kiếm đã escape phải được giữ nguyên');
assert.match(html, /data-action="rcCreateSearchSet" data-action-on="input"/, 'Tìm kiếm phải gọi đúng handler');
assert.match(html, /data-keydown-action="rcCreateFrom" data-keydown-keys='\["Enter"\]'/, 'Phím Enter phải tạo từ giá trị đã nhập');
assert.match(html, /<button>Tạo<\/button>/, 'Nút tạo tùy theo truy vấn phải được ghép vào modal');
assert.match(html, /Danh mục chuẩn/, 'Modal phải có vùng danh mục chuẩn');
assert.match(html, /<button class="refrow">Glucose<\/button>/, 'Các dòng danh mục phải được ghép vào modal');

const emptyProgram = `import { reagentCreateModalHtml } from ${JSON.stringify(pathToFileURL(source).href)}; console.log(reagentCreateModalHtml({searchValueHtml:'',createTypedHtml:'',referenceRowsHtml:'',emptyReferenceHtml:'<div class="empty">Trống</div>',closeButtonHtml:''}));`;
const emptyHtml = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', emptyProgram], { encoding: 'utf8' });
assert.match(emptyHtml, /<div class="empty">Trống<\/div>/, 'Danh mục rỗng phải hiển thị empty state');

console.log('Reagent create modal HTML tests passed');
