'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/const sgImportCohort = \(t: AnyRec, e: AnyRec, level: unknown, cohort: AnyRec\) => deps\.SigmaCohortImportService\.importCohort\(t, e, level, cohort\);/,'Nhập cohort Sigma phải dùng service TypeScript');
assert.match(sigma,/const sgApplyCohortChoices = \(t: AnyRec, e: AnyRec, groups: AnyRec\[\], choices: AnyRec\) => deps\.SigmaCohortImportService\.applyChoices\(t, e, groups, choices\);/,'Áp dụng cohort Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaCohortImportService: SigmaCohortImportService;/,'Nhập cohort Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma cohort import TypeScript bridge tests passed');
