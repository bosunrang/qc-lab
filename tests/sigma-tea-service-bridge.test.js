'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/deps\.SigmaTeaEditService\.setValue\(t, v\)/,'Sửa TEa Sigma phải dùng service TypeScript');
assert.match(sigma,/deps\.SigmaTeaSnapshotService\.syncCurrent\(/,'Snapshot TEa Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaTeaEditService: SigmaTeaEditService;/,'Sửa TEa Sigma phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/SigmaTeaSnapshotService: SigmaTeaSnapshotService;/,'Snapshot TEa Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma TEa service TypeScript bridge tests passed');
