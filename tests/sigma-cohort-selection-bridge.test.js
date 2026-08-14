'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/function sgCohortCutoff\(period\)\{return SigmaCohortSelectionService\.cutoff\(period\);\}/,'Mốc cohort Sigma phải dùng service TypeScript');
assert.match(sigma,/function sgCohortGroups\(t,e\)\{return SigmaCohortSelectionService\.groups\(t,e,sgPeriodLevels\(t,e\),state\);\}/,'Nhóm cohort Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaCohortSelectionService: SigmaCohortSelectionService;/,'Chọn cohort Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma cohort selection TypeScript bridge tests passed');
