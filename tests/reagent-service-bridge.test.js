'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reagent=fs.readFileSync(path.join(root,'assets','modules','reagent.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reagent,/function rcAct\(\)\{return ReagentComparisonService\.find\(state,rcId\);\}/,'So sánh hóa chất phải dùng service TypeScript');
assert.match(reagent,/ReagentComparisonService\.updateCell\(state,/,'Sửa cặp so sánh phải dùng service TypeScript');
assert.match(reagent,/ReagentComparisonWorkflowCommand\.create\(/,'Tạo so sánh phải đi qua workflow command TypeScript');
assert.match(reagent,/ReagentComparisonWorkflowCommand\.remove\(/,'Xóa so sánh phải đi qua workflow command TypeScript');
assert.doesNotMatch(reagent,/ReagentComparisonService\.create\(state,/,'Tạo so sánh không được gọi thẳng service cấp thấp, phải qua workflow command');
assert.match(bridge,/ReagentComparisonService: ReagentComparisonServiceApi;/,'Dịch vụ so sánh hóa chất phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/comparison:root\.ReagentComparisonService,label:comparison=>\(globalThis as any\)\.rcLabel\(comparison\)/,'Workflow command so sánh hóa chất phải bọc service TypeScript');

console.log('Reagent service TypeScript bridge tests passed');
