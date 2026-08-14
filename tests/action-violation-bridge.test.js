'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','actions-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/return ActionViolationService\.info\(a\);/,'Phân loại vi phạm NCE phải dùng service TypeScript');
assert.match(route,/function actionQcVerdictLabel\(a\)\{return ActionViolationService\.verdictLabel\(a\);\}/,'Kết luận QC NCE phải dùng service TypeScript');
assert.match(bridge,/ActionViolationService: ActionViolationService;/,'Phân loại vi phạm NCE phải là hợp đồng bridge bắt buộc');

console.log('Action violation TypeScript bridge tests passed');
