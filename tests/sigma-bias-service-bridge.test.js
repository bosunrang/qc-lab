'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/function sgBiasStats\(rounds\)\{return SigmaBiasService\.stats\(rounds\);\}/,'Thống kê Bias Sigma phải dùng service TypeScript');
assert.match(sigma,/return SigmaBiasService\.applyToPeriods\(data,periodIds,level,bias,rounds,batchId\);/,'Áp dụng Bias Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaBiasService: SigmaBiasService;/,'Dịch vụ Bias Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma bias service TypeScript bridge tests passed');
