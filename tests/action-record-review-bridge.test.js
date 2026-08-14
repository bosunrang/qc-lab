'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const form=fs.readFileSync(path.join(root,'assets','modules','action-form.js'),'utf8');
const route=fs.readFileSync(path.join(root,'assets','modules','actions-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(form,/ActionRecordService\.create\(state\.actions,/,'Tạo hồ sơ NCE phải dùng service TypeScript');
assert.match(form,/ActionRecordService\.update\(editing,/,'Cập nhật hồ sơ NCE phải dùng service TypeScript');
assert.match(route,/ActionReviewService\.approvalReadiness\(a,currentUser\)/,'Duyệt hồ sơ NCE phải dùng service TypeScript');
assert.match(bridge,/ActionReviewService: ActionReviewService;/,'Review NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionRecordService: ActionRecordService;/,'Hồ sơ NCE phải là hợp đồng bridge bắt buộc');

console.log('Action record and review TypeScript bridge tests passed');
