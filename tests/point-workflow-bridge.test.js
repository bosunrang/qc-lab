'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(bridge,/root\.pointRealActions\s*=\s*pointId\s*=>\s*root\.PointWorkflowService!\.real\(root\.pointActions\(pointId\)\)/,'Hồ sơ thực của điểm QC phải dùng service TypeScript');
assert.match(bridge,/root\.pointWorkflowComplete\s*=\s*pointId\s*=>\s*root\.PointWorkflowService!\.complete\(root\.pointActions\(pointId\)\)/,'Trạng thái khép vòng điểm QC phải dùng service TypeScript');
assert.match(bridge,/root\.pointWorkflowSummary\s*=\s*pointId\s*=>\s*root\.PointWorkflowService!\.summary\(root\.pointActions\(pointId\)\)/,'Tóm tắt workflow điểm QC phải dùng service TypeScript');
assert.match(bridge,/PointWorkflowService: ReturnType<typeof createPointWorkflowService>;/,'Workflow điểm QC phải là hợp đồng bridge bắt buộc');

console.log('Point workflow TypeScript bridge tests passed');
