'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reagent=fs.readFileSync(path.join(root,'src','presentation','reagent','reagent-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reagent,/const rcAct = \(\) => deps\.service\.find\(deps\.getState\(\), deps\.ui\(\)\.rcId\);/,'So sánh hóa chất phải dùng service TypeScript');
assert.match(reagent,/deps\.service\.updateCell\(deps\.getState\(\),/,'Sửa cặp so sánh phải dùng service TypeScript');
assert.match(reagent,/deps\.workflow\.create\(/,'Tạo so sánh phải đi qua workflow command TypeScript');
assert.match(reagent,/deps\.workflow\.remove\(/,'Xóa so sánh phải đi qua workflow command TypeScript');
assert.doesNotMatch(reagent,/deps\.service\.create\(/,'Tạo so sánh không được gọi thẳng service cấp thấp, phải qua workflow command');
assert.match(bridge,/ReagentComparisonService: ReagentComparisonServiceApi;/,'Dịch vụ so sánh hóa chất phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/comparison:reagentComparisonService,label:comparison=>\(globalThis as any\)\.rcLabel\(comparison\)/,'Workflow command so sánh hóa chất phải bọc service TypeScript');

console.log('Reagent service TypeScript bridge tests passed');
