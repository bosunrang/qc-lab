'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','report-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/return globalThis\.reportRangePickerHtml\(start,end\);/,'Bộ chọn thời gian báo cáo phải dùng bridge TypeScript');
assert.match(route,/picker=globalThis\.reportLockPicker\(ym,new Date\(\)\.getFullYear\(\)\)/,'Bộ chọn tháng khóa kỳ phải dùng bridge TypeScript');
assert.match(route,/return ReportPeriodPresentation\.currentYearMonth\(reportLockYm,isoMonth\(\)\);/,'Kỳ báo cáo phải dùng presentation TypeScript');
assert.match(route,/PeriodService\.lock\(state,/,'Khóa kỳ phải dùng service TypeScript');
assert.match(route,/PeriodService\.unlock\(state,/,'Mở khóa kỳ phải dùng service TypeScript');
assert.match(route,/return globalThis\.reportLockListHtmlPresentation\(state\.periodLocks\|\|\[\],role\(\)==='admin'\);/,'Danh sách khóa kỳ phải dùng bridge TypeScript');
assert.match(bridge,/reportRangePickerHtml: ReturnType<typeof createReportRangePickerHtml>;/,'Bộ chọn thời gian báo cáo phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/reportLockPicker: typeof reportLockPicker;/,'Bộ chọn tháng khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ReportPeriodPresentation: ReportPeriodPresentation;/,'Kỳ báo cáo phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/PeriodService: PeriodServiceApi;/,'Dịch vụ khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/reportLockPanelHtmlPresentation: ReturnType<typeof createReportLockPanelHtml>;/,'Panel khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/reportLockListHtmlPresentation: ReturnType<typeof createReportLockListHtml<any>>;/,'Danh sách khóa kỳ phải là hợp đồng bridge bắt buộc');

console.log('Report lock TypeScript bridge tests passed');
