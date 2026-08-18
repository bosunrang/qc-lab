'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/presentation/report/report-page-controller.ts'), 'utf8');
const bridge = fs.readFileSync(path.join(root, 'src/compat/modular-pilot.global.ts'), 'utf8');

assert.match(route, /return deps\.pageHtml\(\{ tests, matched, selectedId: reportTest, query: reportQ, start, end, isAdmin: deps\.role\(\) === 'admin', lockPanelHtml: reportLockPanelHtml\(\) \}\)/, 'Trang báo cáo phải dùng renderer TypeScript');
assert.doesNotMatch(route, /globalThis\.reportPageHtml/, 'Không giữ fallback runtime cho renderer báo cáo TypeScript');
assert.match(bridge, /reportPageHtml: ReturnType<typeof createReportPageHtml>;/, 'Renderer báo cáo phải là hợp đồng bridge bắt buộc');

console.log('Report page TypeScript bridge tests passed');
