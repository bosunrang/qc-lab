'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'assets','modules','sigma.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/SigmaPeriodRecordService\.changePeriod\(data,eid,next\)/,'Đổi kỳ Sigma phải dùng service TypeScript');
assert.match(sigma,/SigmaPeriodRecordService\.add\(data,period,uid\(\),sgTeaSnapshot\(t\)\)/,'Thêm kỳ Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaPeriodRecordService: SigmaPeriodRecordService;/,'Dịch vụ bản ghi kỳ Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma period record TypeScript bridge tests passed');
