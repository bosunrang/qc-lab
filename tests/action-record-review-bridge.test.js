'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const form=fs.readFileSync(path.join(root,'src','presentation','actions','action-form-controller.ts'),'utf8');
const route=fs.readFileSync(path.join(root,'src','presentation','actions','actions-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(form,/deps\.NceFormWorkflowCommand\.submit\(\{\s*editId: editing && editing\.id,/,'Tạo/cập nhật hồ sơ NCE phải đi qua workflow TypeScript duy nhất');
assert.match(route,/deps\.ActionReviewService\.approvalReadiness\(a, deps\.currentUser\(\)\)/,'Duyệt hồ sơ NCE phải dùng service TypeScript');
assert.match(bridge,/ActionReviewService: ActionReviewService;/,'Review NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/const actionRecordService: ActionRecordService = createActionRecordService\(/,'Hồ sơ NCE phải là dependency nội bộ của command TypeScript');
assert.doesNotMatch(bridge,/root\.ActionRecordService\s*=/,'Không công bố facade hồ sơ NCE không có caller classic');
assert.match(bridge,/NceFormWorkflowCommand: NceFormWorkflowCommand;/,'Workflow form NCE phải là hợp đồng bridge bắt buộc');
assert.match(route,/deps\.NceLifecycleWorkflowCommand\.execute\(/,'Các mutation lifecycle NCE phải đi qua workflow TypeScript duy nhất');
assert.match(bridge,/NceLifecycleWorkflowCommand: NceLifecycleWorkflowCommand;/,'Workflow lifecycle NCE phải là hợp đồng bridge bắt buộc');

console.log('Action record and review TypeScript bridge tests passed');
