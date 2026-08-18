'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','report','report-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/deps\.rangePickerHtml\(start, end\)/,'Bộ chọn thời gian báo cáo phải dùng bridge TypeScript');
assert.match(route,/picker = deps\.lockPicker\(ym, new Date\(\)\.getFullYear\(\)\)/,'Bộ chọn tháng khóa kỳ phải dùng bridge TypeScript');
assert.match(route,/deps\.periodPresentation\.currentYearMonth\(reportLockYm, deps\.isoMonth\(\)\)/,'Kỳ báo cáo phải dùng presentation TypeScript');
assert.match(route,/deps\.periodWorkflow\.lock\(\{ ym,/,'Khóa kỳ phải dùng workflow TypeScript');
assert.match(route,/deps\.periodWorkflow\.unlock\(\{ ym,/,'Mở khóa kỳ phải dùng workflow TypeScript');
assert.match(route,/deps\.lockListHtml\(deps\.getState\(\)\.periodLocks \|\| \[\], deps\.role\(\) === 'admin'\)/,'Danh sách khóa kỳ phải dùng bridge TypeScript');
assert.match(bridge,/reportRangePickerHtml: ReturnType<typeof createReportRangePickerHtml>;/,'Bộ chọn thời gian báo cáo phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/reportLockPicker: typeof reportLockPicker;/,'Bộ chọn tháng khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ReportPeriodPresentation: ReportPeriodPresentation;/,'Kỳ báo cáo phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/PeriodService: PeriodServiceApi;/,'Dịch vụ khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ReportPeriodWorkflowCommand: ReportPeriodWorkflowCommand;/,'Workflow khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/reportLockPanelHtmlPresentation: ReturnType<typeof createReportLockPanelHtml>;/,'Panel khóa kỳ phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/reportLockListHtmlPresentation: ReturnType<typeof createReportLockListHtml<any>>;/,'Danh sách khóa kỳ phải là hợp đồng bridge bắt buộc');

console.log('Report lock TypeScript bridge tests passed');
