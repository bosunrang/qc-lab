'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','manage-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/return globalThis\.manageShellPresentation\(/,'Shell cấu hình phải dùng bridge TypeScript');
assert.match(route,/return globalThis\.manageToolbarPresentation\(/,'Toolbar cấu hình phải dùng bridge TypeScript');
assert.match(route,/globalThis\.teaReferenceKindPresentation\(/,'Trạng thái TEa phải dùng bridge TypeScript');
assert.match(route,/globalThis\.teaReferenceRowActionsPresentation\(/,'Thao tác TEa phải dùng bridge TypeScript');
assert.match(route,/return globalThis\.manageInstrumentRowPresentation\(model\);/,'Dòng máy xét nghiệm phải dùng bridge TypeScript');
assert.match(route,/return globalThis\.manageLotRowPresentation\(model\);/,'Dòng lô QC phải dùng bridge TypeScript');
assert.match(route,/return globalThis\.manageAssayRowPresentation\(model\);/,'Dòng xét nghiệm phải dùng bridge TypeScript');
assert.match(bridge,/manageToolbarPresentation: ReturnType<typeof createManageToolbarHtml>;/,'Toolbar cấu hình phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/teaReferenceKindPresentation: typeof teaReferenceKind;/,'Trạng thái TEa phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/teaReferenceRowActionsPresentation: typeof teaReferenceRowActions;/,'Thao tác TEa phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageSearchMatchPresentation: typeof manageSearchMatch;/,'Tìm kiếm cấu hình phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageInstrumentNamePresentation: typeof manageInstrumentName;/,'Tên máy cấu hình phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageLotStatusPresentation: ReturnType<typeof createManageLotStatus>;/,'Trạng thái lô QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageShellPresentation: ReturnType<typeof createManageShellHtml>;/,'Shell cấu hình phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageInstrumentRowPresentation: ReturnType<typeof createManageInstrumentRowHtml>;/,'Dòng máy xét nghiệm phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageLotRowPresentation: ReturnType<typeof createManageLotRowHtml>;/,'Dòng lô QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/manageAssayRowPresentation: ReturnType<typeof createManageAssayRowHtml>;/,'Dòng xét nghiệm phải là hợp đồng bridge bắt buộc');

console.log('Manage core TypeScript bridge tests passed');
