'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'assets','modules','reports.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reports,/function reportQcValue\(t,value\)\{return globalThis\.reportQcFormat\.value\(t,value\);\}/,'Giá trị QC báo cáo phải dùng bridge TypeScript');
assert.match(reports,/function reportQcStat\(t,value\)\{return globalThis\.reportQcFormat\.stat\(t,value\);\}/,'Thống kê QC báo cáo phải dùng bridge TypeScript');
assert.match(reports,/function reportQcPoint\(point,t\)\{return globalThis\.reportQcFormat\.point\(point,t\);\}/,'Điểm QC báo cáo phải dùng bridge TypeScript');
assert.match(bridge,/reportQcFormat: ReturnType<typeof createReportQcFormat>;/,'Định dạng QC báo cáo phải là hợp đồng bridge bắt buộc');

console.log('Report QC format TypeScript bridge tests passed');
