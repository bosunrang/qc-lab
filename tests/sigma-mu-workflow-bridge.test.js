'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/SigmaMuWorkflowService\.apply\(sgData\(sgTest\),sgMuCtx\.periodIds,sgMuCtx\.rows,sgMuCtx\.reviewedBy,sgMuCtx\.reviewedDate\)/,'Workflow MU Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaMuWorkflowService: SigmaMuWorkflowService;/,'Workflow MU Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma MU workflow TypeScript bridge tests passed');
