'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const controller=fs.readFileSync(path.join(root,'src','presentation','lis','lis-queue-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

/* assets/modules/lis-queue-ui.js đã retire (Pha G) — logic UI hàng chờ LIS giờ nằm
   trong src/presentation/lis/lis-queue-controller.ts, một adapter DOM/dialog thuần
   nhận mọi phụ thuộc (presentation HTML, application service/command) qua deps. */
assert.match(controller, /lisQueueValueText\s*=\s*\(record[^)]*\)\s*=>\s*deps\.presentation\.valueText\(record\)/,
  'Giá trị hàng đợi LIS phải dùng presentation TypeScript qua deps');
assert.match(controller, /const plan\s*=\s*deps\.settingsService\.prepare\(input\)/,
  'Lưu cấu hình LIS phải dùng service TypeScript qua deps');
assert.match(controller, /lisOnclick\s*=\s*\(functionName[^)]*,\s*messageId[^)]*\)\s*=>\s*deps\.presentation\.onclick\(functionName,\s*messageId\)/,
  'Thao tác hàng đợi LIS phải dùng presentation TypeScript qua deps');
assert.match(controller, /lisQueueRowHtml\s*=\s*\(record[^)]*\)\s*=>\s*deps\.presentation\.rowHtml\(record\)/,
  'Dòng hàng đợi LIS phải dùng presentation TypeScript qua deps');
assert.match(controller, /lisQueueSectionHtml\s*=\s*\(title[^)]*,\s*records[^)]*,\s*emptyText[^)]*\)\s*=>\s*deps\.presentation\.sectionHtml\(title,\s*records,\s*emptyText\)/,
  'Phần hàng đợi LIS phải dùng presentation TypeScript qua deps');
assert.doesNotMatch(controller, /globalThis\./,
  'Controller là adapter DOM thuần, không được đọc globalThis trực tiếp — mọi phụ thuộc phải qua deps');

assert.match(bridge, /lisQueuePresentation: ReturnType<typeof createLisQueuePresentation>;/,
  'Hàng đợi LIS phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /lisSettingsService: ReturnType<typeof createLisSettingsService>;/,
  'Cấu hình LIS phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /const lisQueueController\s*=\s*createLisQueueController\(\{/,
  'Bundle phải khởi tạo controller hàng đợi LIS');
assert.match(bridge, /root\.lisGatewaySaveSettings\s*=\s*lisQueueController\.lisGatewaySaveSettings/,
  'Bundle phải công bố lisGatewaySaveSettings cho onclick handler classic/HTML builder');
assert.match(bridge, /root\.lisOpenQueueModal\s*=\s*lisQueueController\.lisOpenQueueModal/,
  'Bundle phải công bố lisOpenQueueModal cho onclick handler classic/HTML builder');
assert.match(bridge, /root\.lisQueueRefresh\s*=\s*lisQueueController\.lisQueueRefresh/,
  'Bundle phải công bố lisQueueRefresh cho nút "Làm mới" trong modal hàng đợi');
assert.match(bridge, /root\.lisQueueImport\s*=\s*lisQueueController\.lisQueueImport/,
  'Bundle phải công bố lisQueueImport cho nút "Nhận" trong hàng đợi');
assert.match(bridge, /root\.lisQueueReject\s*=\s*lisQueueController\.lisQueueReject/,
  'Bundle phải công bố lisQueueReject cho nút "Bỏ" trong hàng đợi');

const classicFile=path.join(root,'assets','modules','lis-queue-ui.js');
assert.equal(fs.existsSync(classicFile), false,
  'assets/modules/lis-queue-ui.js đã retire — không được tái tạo lại bản classic');

console.log('LIS queue TypeScript bridge tests passed');
