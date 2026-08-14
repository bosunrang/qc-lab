'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'assets','modules','reports.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reports,/function signBlock\(\)\{return globalThis\.reportSignBlock\(\);\}/,'Khối chữ ký phải dùng bridge TypeScript');
assert.match(bridge,/reportSignBlock: typeof reportSignBlock;/,'Khối chữ ký phải là hợp đồng bridge bắt buộc');

console.log('Report sign block TypeScript bridge tests passed');
