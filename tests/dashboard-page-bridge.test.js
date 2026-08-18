'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/presentation/dashboard/dashboard-page-controller.ts'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/compat/modular-pilot.global.ts'), 'utf8');

assert.match(route, /return deps\.dashboardPageHtml\(\{ headHtml, todayText: deps\.vnDate\(today\), mood, moodText, progressHtml, kpisHtml, followHtml, expiringLotsHtml: expHtml, testsPanelHtml \}\);/, 'Dashboard phải dùng page renderer TypeScript');
assert.match(bridge, /dashboardPageHtml: ReturnType<typeof createDashboardPageHtml>;/, 'Dashboard renderer phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /dashboardHeadHtml: ReturnType<typeof createDashboardHeadHtml>;/, 'Header Dashboard phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /dashboardTestPanelHtml: ReturnType<typeof createDashboardTestPanelHtml>;/, 'Panel xét nghiệm Dashboard phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /dashboardKpiItems: typeof dashboardKpiItems;/, 'KPI Dashboard phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /dashboardOverdueActions: ReturnType<typeof createDashboardOverdueActions>;/, 'NCE quá hạn Dashboard phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /dashboardWestgardAlerts: typeof dashboardWestgardAlerts;/, 'Cảnh báo Westgard Dashboard phải là hợp đồng bridge bắt buộc');
assert.match(bridge, /dashboardTestItems: ReturnType<typeof createDashboardTestItems>;/, 'Danh sách xét nghiệm Dashboard phải là hợp đồng bridge bắt buộc');

console.log('Dashboard page TypeScript bridge tests passed');
