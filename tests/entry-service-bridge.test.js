'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','entry-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/globalThis\.EntryRecordCommand\.execute\(/,'Ghi điểm QC phải dùng command TypeScript');
assert.match(route,/globalThis\.EntryVoidCommand\.execute\(/,'Hủy điểm QC phải dùng command TypeScript');
assert.match(route,/EntryService\.buildSheetRowsData\(/,'Bảng nhập QC phải dùng service TypeScript');
assert.match(bridge,/EntryService: EntryServiceApi;/,'Dịch vụ nhập QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/EntryRecordCommand: EntryRecordCommand;/,'Command ghi điểm QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/EntryVoidCommand: EntryVoidCommand;/,'Command hủy điểm QC phải là hợp đồng bridge bắt buộc');

console.log('Entry service TypeScript bridge tests passed');
