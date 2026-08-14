'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const ui=fs.readFileSync(path.join(root,'assets','modules','lis-queue-ui.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(ui,/function lisQueueValueText\(record\)\{\s*return globalThis\.lisQueuePresentation\.valueText\(record\);/,'Giá trị hàng đợi LIS phải dùng bridge TypeScript');
assert.match(ui,/plan=globalThis\.lisSettingsService\.prepare\(input\),url=plan\.ok\?plan\.settings\.url/,'Lưu cấu hình LIS phải dùng service TypeScript');
assert.match(ui,/function lisOnclick\(fnName,messageId\)\{return globalThis\.lisQueuePresentation\.onclick\(fnName,messageId\);\}/,'Thao tác hàng đợi LIS phải dùng bridge TypeScript');
assert.match(ui,/function lisQueueRowHtml\(record\)\{\s*return globalThis\.lisQueuePresentation\.rowHtml\(record\);/,'Dòng hàng đợi LIS phải dùng bridge TypeScript');
assert.match(ui,/function lisQueueSectionHtml\(title,records,emptyText\)\{\s*return globalThis\.lisQueuePresentation\.sectionHtml\(title,records,emptyText\);/,'Phần hàng đợi LIS phải dùng bridge TypeScript');
assert.match(bridge,/lisQueuePresentation: ReturnType<typeof createLisQueuePresentation>;/,'Hàng đợi LIS phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/lisSettingsService: ReturnType<typeof createLisSettingsService>;/,'Cấu hình LIS phải là hợp đồng bridge bắt buộc');

console.log('LIS queue TypeScript bridge tests passed');
