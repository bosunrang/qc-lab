'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'src','presentation','report','report-print-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reports,/function reportQcValue\(t: any, value: unknown\) \{ return deps\.reportQcFormat\.value\(t, value\); \}/,'Giá trị QC báo cáo phải dùng dependency injected');
assert.match(reports,/function reportQcStat\(t: any, value: unknown\) \{ return deps\.reportQcFormat\.stat\(t, value\); \}/,'Thống kê QC báo cáo phải dùng dependency injected');
assert.match(reports,/function reportQcPoint\(point: any, t: any\) \{ return deps\.reportQcFormat\.point\(point, t\); \}/,'Điểm QC báo cáo phải dùng dependency injected');
assert.match(bridge,/reportQcFormat: ReturnType<typeof createReportQcFormat>;/,'Định dạng QC báo cáo phải là hợp đồng bridge bắt buộc');

console.log('Report QC format TypeScript bridge tests passed');
