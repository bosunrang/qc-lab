'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const workflow=fs.readFileSync(path.join(root,'assets','modules','action-workflow-service.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(workflow,/function pointRealActions\(pointId\)\{\s*return root\.PointWorkflowService\.real\(pointActions\(pointId\)\);/,'Hồ sơ thực của điểm QC phải dùng service TypeScript');
assert.match(workflow,/function pointWorkflowComplete\(pointId\)\{\s*return root\.PointWorkflowService\.complete\(pointActions\(pointId\)\);/,'Trạng thái khép vòng điểm QC phải dùng service TypeScript');
assert.match(workflow,/function pointWorkflowSummary\(pointId\)\{\s*return root\.PointWorkflowService\.summary\(pointActions\(pointId\)\);/,'Tóm tắt workflow điểm QC phải dùng service TypeScript');
assert.match(bridge,/PointWorkflowService: ReturnType<typeof createPointWorkflowService>;/,'Workflow điểm QC phải là hợp đồng bridge bắt buộc');

console.log('Point workflow TypeScript bridge tests passed');
