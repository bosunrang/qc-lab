'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/function sgCleanCell\(field,val\)\{return SigmaLevelEditService\.clean\(field,val\);\}/,'Chuẩn hóa mức Sigma phải dùng service TypeScript');
assert.match(sigma,/SigmaLevelEditService\.update\(L,field,val\)/,'Sửa mức Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaLevelEditService: SigmaLevelEditService;/,'Dịch vụ sửa mức Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma level edit TypeScript bridge tests passed');
