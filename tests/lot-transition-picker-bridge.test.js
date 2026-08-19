'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const actions=fs.readFileSync(path.join(root,'src','presentation','manage','manage-tests-actions-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(actions,/deps\.LotTransitionPickerService\.label\(lot\);/,'Nhãn lô chuyển tiếp phải dùng service TypeScript');
assert.match(actions,/deps\.LotTransitionPickerService\.availableLots\(state\(\)\.qcLots \|\| \[\], selectedId\);/,'Chọn lô chuyển tiếp phải dùng service TypeScript');
assert.match(bridge,/LotTransitionPickerService: LotTransitionPickerServiceApi;/,'Dịch vụ chọn lô chuyển tiếp phải là hợp đồng bridge bắt buộc');

console.log('Lot transition picker TypeScript bridge tests passed');
