'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/SigmaCohortService\.normalizePeriod\(period\)/,'Kỳ Sigma phải dùng service TypeScript');
assert.match(sigma,/SigmaCohortService\.assess\(x\)/,'Đánh giá cohort Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaCohortService: SigmaCohortServiceApi;/,'Dịch vụ cohort Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma cohort service TypeScript bridge tests passed');
