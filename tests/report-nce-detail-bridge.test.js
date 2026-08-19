'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const reports=fs.readFileSync(path.join(root,'src','presentation','report','report-print-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(reports,/function reportNceDetailField\(label: any, value: any, wide = false\) \{ return deps\.actionReportHtml\.detailField\(label, value, wide\); \}/,'Chi tiết NCE báo cáo phải dùng dependency injected');
assert.match(bridge,/actionReportHtml: ReturnType<typeof createActionReportHtml>;/,'Chi tiết NCE báo cáo phải là hợp đồng bridge bắt buộc');

assert.match(reports,/function reportNceDetailHtml\(a: any, t: any\) \{ return deps\.reportNceDetailHtmlPresentation\(a, t\); \}/,'NCE detail must call the required TypeScript renderer directly');

console.log('Report NCE detail TypeScript bridge tests passed');
