'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const form=fs.readFileSync(path.join(root,'assets','modules','action-form.js'),'utf8');
const route=fs.readFileSync(path.join(root,'assets','modules','actions-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(form,/globalThis\.NceFormCommand\.submit\(\{actions:state\.actions,/,'Tạo/cập nhật hồ sơ NCE phải đi qua command TypeScript duy nhất');
assert.match(route,/ActionReviewService\.approvalReadiness\(a,currentUser\)/,'Duyệt hồ sơ NCE phải dùng service TypeScript');
assert.match(bridge,/ActionReviewService: ActionReviewService;/,'Review NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionRecordService: ActionRecordService;/,'Hồ sơ NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/NceFormCommand: NceFormCommand;/,'Command form NCE phải là hợp đồng bridge bắt buộc');
assert.match(route,/globalThis\.NceLifecycleCommand\.execute\(/,'Các mutation lifecycle NCE phải đi qua command TypeScript duy nhất');
assert.match(bridge,/NceLifecycleCommand: NceLifecycleCommand;/,'Command lifecycle NCE phải là hợp đồng bridge bắt buộc');

console.log('Action record and review TypeScript bridge tests passed');
