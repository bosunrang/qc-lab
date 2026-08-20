'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(bridge,/root\.activityCSVRows\s*=\s*items\s*=>\s*root\.activityAuditCsv\(items\)/,'Xuất CSV nhật ký phải dùng bridge TypeScript');
assert.match(bridge,/activityAuditCsv: ReturnType<typeof createActivityAuditCsv>;/,'Xuất CSV nhật ký phải là hợp đồng bridge bắt buộc');

console.log('Activity audit CSV TypeScript bridge tests passed');
