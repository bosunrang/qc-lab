'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/deps\.SigmaTrackedTestService\.track\(state\(\)\.tests \|\| \[\], id\)/,'Theo dõi xét nghiệm Sigma phải dùng service TypeScript');
assert.match(sigma,/deps\.SigmaTrackedTestService\.remove\(state\(\)\.tests \|\| \[\], id, ui\(\)\.sgTest\)/,'Bỏ theo dõi xét nghiệm Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaTrackedTestService: SigmaTrackedTestService;/,'Dịch vụ theo dõi Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma tracked test TypeScript bridge tests passed');
