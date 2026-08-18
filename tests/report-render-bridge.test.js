'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','report','report-page-controller.ts'),'utf8');
const reports=fs.readFileSync(path.join(root,'assets','modules','reports.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

for(const [name,type] of [
  ['reportLabels','ReturnType<typeof createReportLabels>'],
  ['reportSelection','ReturnType<typeof createReportSelection>'],
  ['reportSearch','ReturnType<typeof createReportSearch>'],
  ['reportPointsTableService','ReturnType<typeof createReportPointsTable>'],
  ['reportNceAppendixPresentation','ReportNceAppendixApi'],
  ['reportNceDetailHtmlPresentation','ReturnType<typeof createReportNceDetailHtml>']
]){
  const escaped=type.replace(/[<>()[\]{}?+*.$^|\\]/g,'\\$&');
  assert.match(bridge,new RegExp(`${name}: ${escaped};`),`${name} must be a required report UI bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}=`),`${name} must be assigned by the TypeScript bootstrap`);
}
assert.match(route,/deps\.reportSearch\.select\(/,'Bộ tìm kiếm báo cáo phải dùng bridge TypeScript');
assert.match(route,/deps\.reportSelection\.exportSelection\(/,'Lựa chọn báo cáo phải dùng bridge TypeScript');
assert.match(route,/deps\.rangeText\(start, end\)/,'Nhãn phạm vi báo cáo phải dùng bridge TypeScript');
assert.match(reports,/globalThis\.reportPointsTableService\(items,t\)/,'Bảng điểm QC báo cáo phải dùng bridge TypeScript');
assert.match(reports,/globalThis\.reportNceDetailHtmlPresentation\(a,t\)/,'Chi tiết NCE báo cáo phải dùng bridge TypeScript');
assert.match(reports,/globalThis\.reportNceAppendixPresentation\(actions,t\)/,'Phụ lục NCE phải dùng bridge TypeScript');

console.log('Report renderer TypeScript bridge tests passed');
