'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','actions-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/return ActionEscalationService\.canEscalate\(state\.actions\|\|\[\],a\);/,'Chuyển tiếp NCE phải dùng service TypeScript');
assert.match(route,/NceLifecycleWorkflowCommand\.execute\(\{kind:'escalate'/,'Tạo hồ sơ NCE tiếp theo phải dùng workflow TypeScript');
assert.match(bridge,/ActionEscalationService: ActionEscalationService;/,'Chuyển tiếp NCE phải là hợp đồng bridge bắt buộc');

console.log('Action escalation TypeScript bridge tests passed');
