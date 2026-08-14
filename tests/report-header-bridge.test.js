'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'assets','modules','reports.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reports,/function reportHeader\(title,subtitle='Nội kiểm chất lượng xét nghiệm'\)\{return globalThis\.reportHeaderPresentation\(/,'Header báo cáo phải dùng bridge TypeScript');
assert.match(bridge,/reportHeaderPresentation: typeof reportHeaderPresentation;/,'Header báo cáo phải là hợp đồng bridge bắt buộc');

console.log('Report header TypeScript bridge tests passed');
