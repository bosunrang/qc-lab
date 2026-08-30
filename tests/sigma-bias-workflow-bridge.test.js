'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/deps\.SigmaBiasWorkflowService\.apply\(sgData\(ui\(\)\.sgTest\), periodIds, level, rounds\)/,'Workflow Bias Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaBiasWorkflowService: SigmaBiasWorkflowService;/,'Workflow Bias Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma bias workflow TypeScript bridge tests passed');
