'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/const sgZone = \(s: unknown\) => deps\.SigmaPresentation\.sigmaZone\(s\);/,'Vùng Sigma phải dùng presentation TypeScript');
// sgRun() (SigmaPresentation.sigmaRunPlan wrapper) was confirmed to have zero callers
// anywhere (not even internal) when sigma.js retired to TypeScript (Pha G route slice
// 12) — dropped rather than ported, matching the precedent of dropping confirmed-dead
// wrappers (lotPointsToRename, actionEvidenceTime) in earlier slices.
assert.doesNotMatch(sigma,/\bsgRun\b/,'sgRun() đã xác nhận không còn caller nào, không được tái tạo lại');
assert.match(bridge,/SigmaPresentation: SigmaPresentation;/,'Presentation Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma presentation TypeScript bridge tests passed');
