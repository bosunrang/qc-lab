'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/deps\.SigmaMuWorkflowCommand\.apply\(\{ records: sgData\(ui\(\)\.sgTest\), periodIds: ui\(\)\.sgMuCtx\.periodIds, rows: ui\(\)\.sgMuCtx\.rows, reviewedBy: ui\(\)\.sgMuCtx\.reviewedBy, reviewedDate: ui\(\)\.sgMuCtx\.reviewedDate,/,'Áp dụng ngân sách MU phải đi qua workflow command TypeScript');
assert.doesNotMatch(sigma,/SigmaMuWorkflowService\.apply\(/,'Áp dụng ngân sách MU không được gọi thẳng service cấp thấp, phải qua workflow command');
assert.match(bridge,/SigmaMuWorkflowService: SigmaMuWorkflowService;/,'Service MU Sigma phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/SigmaMuWorkflowCommand: SigmaMuWorkflowCommand;/,'Workflow command MU Sigma phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/service:root\.SigmaMuWorkflowService/,'Workflow command MU Sigma phải bọc service TypeScript');

console.log('Sigma MU workflow TypeScript bridge tests passed');
