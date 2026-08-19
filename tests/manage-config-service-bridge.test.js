'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const actions=fs.readFileSync(path.join(root,'src','presentation','manage','manage-tests-actions-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(bridge,/ManageConfigService\.applyTargetMatrix\(/,'Áp dụng Mean\/SD phải dùng service TypeScript');
assert.match(actions,/ManageTargetMatrixWorkflowCommand\.commit\(/,'Áp dụng Mean\/SD phải đi qua workflow command TypeScript');
assert.match(actions,/ManageLotTransitionWorkflowCommand\.execute\(/,'Lưu chuyển tiếp lô phải đi qua workflow command TypeScript');
assert.match(actions,/ManageLotGroupWorkflowCommand\.executeActivation\(/,'Kích hoạt nhóm lô phải đi qua workflow command TypeScript');
assert.match(actions,/ManageLotGroupWorkflowCommand\.save\(/,'Lưu nhóm lô phải đi qua workflow command TypeScript');
assert.match(actions,/ManageLotGroupWorkflowCommand\.remove\(/,'Xóa nhóm lô phải đi qua workflow command TypeScript');
assert.match(actions,/ManageLotWorkflowCommand\.execute\(/,'Lưu lô QC phải đi qua workflow command TypeScript');
assert.match(bridge,/ManageConfigService: ManageConfigServiceApi;/,'Dịch vụ cấu hình phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/save:\(s,i\)=>root\.ManageConfigService\.saveLotTransition\(/,'Command chuyển tiếp lô phải nối vào service TypeScript');
assert.match(bridge,/save:\(s,i\)=>root\.ManageConfigService\.saveLot\(/,'Command lô QC phải nối vào service TypeScript');
assert.match(bridge,/applyActivation:input=>root\.ManageConfigService\.applyLotGroupActivation\(/,'Command kích hoạt nhóm lô phải nối vào service TypeScript');
assert.match(bridge,/lot:manageLotCommand/,'Workflow command lô QC phải bọc command TypeScript cấp thấp hơn');
assert.match(bridge,/activation:manageLotGroupActivationCommand/,'Workflow command kích hoạt nhóm lô phải bọc command TypeScript cấp thấp hơn');
assert.match(bridge,/group:manageLotGroupCommand/,'Workflow command nhóm lô phải bọc command TypeScript cấp thấp hơn');
assert.match(bridge,/matrix:targetMatrixCommand/,'Workflow command Mean\/SD phải bọc command TypeScript cấp thấp hơn');
assert.match(bridge,/transition:root\.ManageLotTransitionCommand/,'Workflow command chuyển tiếp lô phải bọc command TypeScript cấp thấp hơn');

console.log('Manage config service TypeScript bridge tests passed');
