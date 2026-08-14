'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const workflow=fs.readFileSync(path.join(root,'assets','modules','action-workflow-service.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(workflow,/function invalidateActionCaches\(testId\)\{\s*root\.ActionRerunService\.invalidate\(testId\);root\.ActionPointIndexService\.invalidate\(\);return;/,'Xóa cache NCE phải dùng chỉ mục TypeScript');
assert.match(workflow,/function pointActions\(pointId\)\{\s*return root\.ActionPointIndexService\.forPoint\(pointId\);/,'Tra cứu điểm NCE phải dùng chỉ mục TypeScript');
assert.match(bridge,/ActionPointIndexService: ActionPointIndexService;/,'Chỉ mục điểm NCE phải là hợp đồng bridge bắt buộc');

console.log('Action point index TypeScript bridge tests passed');
