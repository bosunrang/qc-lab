'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/const sgBiasStats = \(rounds: AnyRec\[\]\) => deps\.SigmaBiasService\.stats\(rounds\);/,'Thống kê Bias Sigma phải dùng service TypeScript');
assert.match(sigma,/deps\.SigmaBiasService\.applyToPeriods\(data, periodIds, level, bias, rounds, batchId\)/,'Áp dụng Bias Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaBiasService: SigmaBiasService;/,'Dịch vụ Bias Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma bias service TypeScript bridge tests passed');
