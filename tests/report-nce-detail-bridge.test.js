'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'assets','modules','reports.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reports,/function reportNceDetailField\(label,value,wide=false\)\{return globalThis\.actionReportHtml\.detailField\(label,value,wide\);\}/,'Chi tiết NCE báo cáo phải dùng bridge TypeScript');
assert.match(bridge,/actionReportHtml: ReturnType<typeof createActionReportHtml>;/,'Chi tiết NCE báo cáo phải là hợp đồng bridge bắt buộc');

assert.match(reports,/function reportNceDetailHtml\(a,t\)\{\s*return globalThis\.reportNceDetailHtmlPresentation\(a,t\);\s*\}/,'NCE detail must call the required TypeScript renderer directly');

console.log('Report NCE detail TypeScript bridge tests passed');
