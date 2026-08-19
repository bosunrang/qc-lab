'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','entry','entry-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/deps\.EntryRecordWorkflowCommand\.execute\(/,'Ghi điểm QC phải dùng workflow TypeScript');
assert.match(route,/deps\.EntryVoidWorkflowCommand\.execute\(/,'Hủy điểm QC phải dùng workflow TypeScript');
assert.match(route,/EntryService\.buildSheetRowsData\(/,'Bảng nhập QC phải dùng service TypeScript');
assert.match(bridge,/EntryService: EntryServiceApi;/,'Dịch vụ nhập QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/EntryRecordWorkflowCommand: EntryRecordWorkflowCommand;/,'Workflow ghi điểm QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/EntryVoidWorkflowCommand: EntryVoidWorkflowCommand;/,'Workflow hủy điểm QC phải là hợp đồng bridge bắt buộc');

console.log('Entry service TypeScript bridge tests passed');
