'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadSandbox, run } = require('./helpers/sandbox');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const route = read('src/presentation/manage/manage-page-controller.ts');
const bridge = read('src/compat/modular-pilot.global.ts');

assert.match(route, /deps\.pres\.historySearchValuesPresentation\(t, state\(\)\.qcLots, deps\.testDisplayName\)/, 'Lịch sử QC phải dùng presentation TypeScript để tạo dữ liệu tìm kiếm');
assert.match(route, /const rows = deps\.pres\.historyRowsPresentation\(t, state\(\)\.qcLots, state\(\)\.data\[t\.id\] \|\| \[\], lotGroupLabels\)/, 'Lịch sử QC phải dùng presentation TypeScript để tạo các mốc lô');
assert.match(route, /deps\.pres\.historyRowSortPresentation\(visibleRows\)\.map/, 'Lịch sử QC phải dùng presentation TypeScript để sắp xếp mốc');
assert.doesNotMatch(route, /historyRowsPresentation\?/, 'Không giữ fallback classic cho các mốc lịch sử QC');
assert.match(bridge, /historyRowsPresentation: typeof historyRows;/, 'Bridge phải coi presentation mốc lịch sử là hợp đồng bắt buộc');
assert.match(route, /const teaRefFind = \(refKey: unknown\) => deps\.TeaReferenceService\.find\(state\(\), refKey\);/, 'Tra cứu TEa phải dùng service TypeScript');
assert.match(route, /const teaRefEnsure = \(refKey: unknown\) => deps\.TeaReferenceService\.ensure\(state\(\), refKey\)\.record;/, 'Tạo TEa phải dùng service TypeScript');
assert.match(route, /deps\.TeaReferenceWorkflowCommand\.edit\(\{ name, field, val \}\)/, 'Sửa TEa phải đi qua workflow command TypeScript');
assert.match(route, /deps\.TeaReferenceWorkflowCommand\.remove\(\{ refKey, isDefault \}\)/, 'Khôi phục hoặc xóa TEa phải đi qua workflow command TypeScript');
assert.match(route, /deps\.TeaReferenceWorkflowCommand\.addCustom\(\{ data \}\)/, 'Thêm TEa phải đi qua workflow command TypeScript');
assert.match(route, /deps\.TeaReferenceWorkflowCommand\.saveLabProfile\(\{ refKey, profile \}\)/, 'Lưu hồ sơ TEa chuẩn hóa phải đi qua workflow command TypeScript');
assert.match(route, /deps\.TeaReferenceWorkflowCommand\.removeLabProfile\(\{ refKey, isDefault \}\)/, 'Xóa hồ sơ TEa chuẩn hóa phải đi qua workflow command TypeScript');
assert.match(bridge, /service:root\.TeaReferenceService/, 'Workflow command TEa phải bọc service TypeScript');
assert.doesNotMatch(route, /TeaReferenceService&&/, 'Không giữ fallback classic cho command TEa');
assert.doesNotMatch(route, /if\s*\(globalThis\.TeaReferenceService\)/, 'Không giữ fallback classic khi tra cứu TEa');
assert.match(bridge, /TeaReferenceService: TeaReferenceServiceApi;/, 'Service TEa phải là hợp đồng bridge bắt buộc');

/* Hồi quy: TeaReferenceService's sourceRegistry dep từng đọc
   (globalThis as any).TEA_SOURCE_REGISTRY — nhưng TEA_SOURCE_REGISTRY là `const`
   global lexical của state.js (như REFTESTS), không phải property trên
   globalThis, nên luôn undefined và mọi lần sửa CLIA/Ricos trong tab "Bảng TEa
   tham chiếu" ném TypeError ngay lập tức. Không có test nào (kể cả các assertion
   source-scanner ở trên hay bài unit test tự stub sourceRegistry của
   tea-reference-service.test.js) từng gọi qua ĐÚNG dây chuyền thật này để bắt
   được lỗi — chỉ lộ ra khi dò trực tiếp qua vm với state.js + bundle thật. */
{
  const ctx = loadSandbox(['core.js', 'generated/modular-pilot.js']);
  run(ctx, "state={tests:[],teaRefs:[]};");
  const edited = run(ctx, "TeaReferenceService.edit(state,'qclab-glucose','clia',9)");
  assert.equal(edited.record.clia, 9, 'sửa CLIA phải cập nhật đúng giá trị');
  const claSource = edited.source;
  assert.ok(claSource && claSource.document, 'nguồn CLIA phải có tài liệu tham chiếu thật từ TEA_SOURCE_REGISTRY, không phải object rỗng do sourceRegistry() trả undefined');
  assert.equal(claSource.effectiveDate, '2024-07-11', 'phải lấy đúng ngày hiệu lực CLIA CMS-3355-F từ registry thật');
}

console.log('Manage history TypeScript bridge tests passed');
