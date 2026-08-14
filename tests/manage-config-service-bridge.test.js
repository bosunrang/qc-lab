'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const actions=fs.readFileSync(path.join(root,'assets','modules','manage-tests-actions.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(actions,/ManageConfigService\.applyTargetMatrix\(/,'Áp dụng Mean\/SD phải dùng service TypeScript');
assert.match(actions,/ManageConfigService\.saveLotTransition\(/,'Lưu chuyển tiếp lô phải dùng service TypeScript');
assert.match(actions,/ManageConfigService\.saveLot\(/,'Lưu lô QC phải dùng service TypeScript');
assert.match(bridge,/ManageConfigService: ManageConfigServiceApi;/,'Dịch vụ cấu hình phải là hợp đồng bridge bắt buộc');

console.log('Manage config service TypeScript bridge tests passed');
