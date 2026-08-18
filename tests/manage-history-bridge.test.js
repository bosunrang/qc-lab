'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('assets/modules/manage-routes.js');
const bridge = read('src/compat/modular-pilot.global.ts');

assert.match(route, /return globalThis\.historySearchValuesPresentation\(t,state\.qcLots,testDisplayName\);/, 'Lịch sử QC phải dùng presentation TypeScript để tạo dữ liệu tìm kiếm');
assert.match(route, /const rows=globalThis\.historyRowsPresentation\(t,state\.qcLots,state\.data\[t\.id\]\|\|\[\],lotGroupLabels\);/, 'Lịch sử QC phải dùng presentation TypeScript để tạo các mốc lô');
assert.match(route, /const html=globalThis\.historyRowSortPresentation\(visibleRows\)\.map/, 'Lịch sử QC phải dùng presentation TypeScript để sắp xếp mốc');
assert.match(route, /globalThis\.historyPanelPresentation\(\{selectorHtml:globalThis\.historySelectorPresentation\(opts,historyTotals\.rowCount,historyTotals\.pointCount\),tableHtml:globalThis\.historyTablePresentation\(html,q\?emptyState/, 'Panel lịch sử phải do presentation TypeScript dựng');
assert.doesNotMatch(route, /historyRowsPresentation\?/, 'Không giữ fallback classic cho các mốc lịch sử QC');
assert.doesNotMatch(route, /historySelectorPresentation\?/, 'Không giữ fallback classic cho bộ chọn lịch sử QC');
assert.doesNotMatch(route, /historyTablePresentation\?/, 'Không giữ fallback classic cho bảng lịch sử QC');
assert.match(bridge, /historyRowsPresentation: typeof historyRows;/, 'Bridge phải coi presentation mốc lịch sử là hợp đồng bắt buộc');
assert.match(bridge, /historyTablePresentation: typeof historyTableHtml;/, 'Bridge phải coi presentation bảng lịch sử là hợp đồng bắt buộc');
assert.match(bridge, /historyPanelPresentation: typeof historyPanelHtml;/, 'Bridge phải coi presentation panel lịch sử là hợp đồng bắt buộc');
assert.match(route, /function teaRefFind\(refKey\)\{return globalThis\.TeaReferenceService\.find\(state,refKey\);\}/, 'Tra cứu TEa phải dùng service TypeScript');
assert.match(route, /function teaRefEnsure\(refKey\)\{return globalThis\.TeaReferenceService\.ensure\(state,refKey\)\.record;\}/, 'Tạo TEa phải dùng service TypeScript');
assert.match(route, /globalThis\.TeaReferenceWorkflowCommand\.edit\(\{name,field,val\}\);/, 'Sửa TEa phải đi qua workflow command TypeScript');
assert.match(route, /globalThis\.TeaReferenceWorkflowCommand\.remove\(\{refKey,isDefault\}\);/, 'Khôi phục hoặc xóa TEa phải đi qua workflow command TypeScript');
assert.match(route, /globalThis\.TeaReferenceWorkflowCommand\.addCustom\(\{data\}\);/, 'Thêm TEa phải đi qua workflow command TypeScript');
assert.match(route, /globalThis\.TeaReferenceWorkflowCommand\.saveLabProfile\(\{refKey,profile\}\);/, 'Lưu hồ sơ TEa chuẩn hóa phải đi qua workflow command TypeScript');
assert.match(route, /globalThis\.TeaReferenceWorkflowCommand\.removeLabProfile\(\{refKey,isDefault\}\);/, 'Xóa hồ sơ TEa chuẩn hóa phải đi qua workflow command TypeScript');
assert.match(bridge, /service:root\.TeaReferenceService/, 'Workflow command TEa phải bọc service TypeScript');
assert.doesNotMatch(route, /TeaReferenceService&&/, 'Không giữ fallback classic cho command TEa');
assert.doesNotMatch(route, /function teaRefFind\(refKey\)\{if\(globalThis\.TeaReferenceService\)/, 'Không giữ fallback classic khi tra cứu TEa');
assert.match(bridge, /TeaReferenceService: TeaReferenceServiceApi;/, 'Service TEa phải là hợp đồng bridge bắt buộc');

console.log('Manage history TypeScript bridge tests passed');
