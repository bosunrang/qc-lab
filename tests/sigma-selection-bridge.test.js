'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/SigmaLevelSelectionService\.historical\(/,'Chọn mức Sigma phải dùng service TypeScript');
assert.match(sigma,/SigmaPeriodSelectionService\.select\(/,'Chọn kỳ Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaLevelSelectionService: SigmaLevelSelectionService;/,'Chọn mức Sigma phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/SigmaPeriodSelectionService: SigmaPeriodSelectionService;/,'Chọn kỳ Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma selection TypeScript bridge tests passed');
