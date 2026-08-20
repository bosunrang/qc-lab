'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(bridge,/root\.invalidateActionCaches\s*=\s*testId\s*=>\s*\{\s*root\.ActionRerunService!\.invalidate\(testId\);\s*root\.ActionPointIndexService!\.invalidate\(\);\s*\}/,'Xóa cache NCE phải dùng chỉ mục TypeScript');
assert.match(bridge,/root\.pointActions\s*=\s*pointId\s*=>\s*root\.ActionPointIndexService!\.forPoint\(pointId\)/,'Tra cứu điểm NCE phải dùng chỉ mục TypeScript');
assert.match(bridge,/ActionPointIndexService: ActionPointIndexService;/,'Chỉ mục điểm NCE phải là hợp đồng bridge bắt buộc');

console.log('Action point index TypeScript bridge tests passed');
