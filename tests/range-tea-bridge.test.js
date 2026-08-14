'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const range=fs.readFileSync(path.join(root,'assets','modules','range.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(range,/function rangeTeaPercent\(t,l\)\{return globalThis\.qcRangeTea\.percent\(t,l\);\}/,'TEa của dải QC phải dùng bridge TypeScript');
assert.match(range,/function rangeCandidate\(tid,level\)\{return globalThis\.qcRangeCandidateService\.candidate\(tid,level\);/,'Ứng viên dải QC phải dùng bridge TypeScript');
assert.match(range,/threshold=globalThis\.qcRangeTea\.quarter\(tea\)/,'Ngưỡng TEa/4 phải dùng bridge TypeScript');
assert.match(range,/return globalThis\.qcRangeSafetyGate\(r\.nce,tea,!!\(causeEl&&causeEl\.checked\),bias\)\.passes;/,'Cổng an toàn dải QC phải dùng bridge TypeScript');
assert.match(range,/result=globalThis\.qcRangeBiasEvaluation\(tea,bias,r\.l\.sd,QCCore\.systematicShiftCritical\);/,'Đánh giá Bias phải dùng bridge TypeScript');
assert.match(bridge,/qcRangeTea: ReturnType<typeof createRangeTea>;/,'TEa dải QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/qcRangeCandidateService: ReturnType<typeof createRangeCandidateService>;/,'Ứng viên dải QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/qcRangeSafetyGate: typeof rangeSafetyGate;/,'Cổng an toàn dải QC phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/qcRangeBiasEvaluation: typeof rangeBiasEvaluation;/,'Đánh giá Bias phải là hợp đồng bridge bắt buộc');

console.log('Range TEa TypeScript bridge tests passed');
