'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','dashboard','dashboard-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/const pageDashLoading = \(tests: AnyRec\[\], pending: number\) => deps\.dashboardLoadingPresentation\(tests, pending, deps\.stateData\(\), deps\.stateLab\(\)\);/,'Dashboard đang tải phải dùng renderer TypeScript');
assert.match(bridge,/dashboardLoadingPresentation: ReturnType<typeof createDashboardLoading>;/,'Dashboard đang tải phải là hợp đồng bridge bắt buộc');
assert.doesNotMatch(bridge,/dashboardQcFollowupItemHtml: ReturnType<typeof createDashboardQcFollowupItemHtml>;/,'Dòng theo dõi Dashboard phải là dependency nội bộ bundle');
assert.doesNotMatch(bridge,/dashboardTestRowHtml: ReturnType<typeof createDashboardTestRowHtml>;/,'Dòng xét nghiệm Dashboard phải là dependency nội bộ bundle');
assert.match(bridge,/dashboardEmptyTestsHtml: ReturnType<typeof createDashboardEmptyTestsHtml>;/,'Trạng thái trống Dashboard phải là hợp đồng bridge bắt buộc');

console.log('Dashboard loading TypeScript bridge tests passed');
