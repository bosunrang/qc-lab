'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','manage','manage-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/deps\.pres\.targetMatrixItemsPresentation\(tests, levelLots, deps\.targetConfigAssigned, deps\.plannedTargetFor, deps\.lotTargetSnapshot\)/,'Ma trận Mean\/SD phải dùng model TypeScript');
assert.match(route,/deps\.pres\.targetMatrixRowPresentation\(\{/,'Dòng Mean\/SD phải dùng renderer TypeScript');
assert.match(route,/deps\.pres\.targetSelectorPresentation\(deps\.pres\.targetPanelOptionsPresentation\(state\(\)\.qcPanels, ui\(\)\.manageTargetPanel, instrumentName, deps\.esc\), targetGroupOptions\(\)\)/,'Bộ chọn Mean/SD phải dùng renderer TypeScript');
assert.match(bridge,/targetMatrixItemsPresentation: typeof targetMatrixItems;/,'Model ma trận Mean\/SD phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/targetMatrixRowPresentation: typeof targetMatrixRowHtml;/,'Dòng Mean\/SD phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/targetMatrixActionsPresentation: typeof targetMatrixActionsHtml;/,'Thao tác Mean\/SD phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/targetPrerequisitePresentation: typeof targetPrerequisite;/,'Điều kiện Mean\/SD phải là hợp đồng bridge bắt buộc');

console.log('Target matrix TypeScript bridge tests passed');
