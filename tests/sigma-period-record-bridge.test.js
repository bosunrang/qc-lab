'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const sigma=fs.readFileSync(path.join(root,'src','presentation','sigma','sigma-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(sigma,/deps\.SigmaPeriodRecordService\.changePeriod\(data, eid, next\)/,'Đổi kỳ Sigma phải dùng service TypeScript');
assert.match(sigma,/deps\.SigmaPeriodRecordService\.add\(data, period, deps\.uid\(\), deps\.sgTeaSnapshot\(t\)\)/,'Thêm kỳ Sigma phải dùng service TypeScript');
assert.match(bridge,/SigmaPeriodRecordService: SigmaPeriodRecordService;/,'Dịch vụ bản ghi kỳ Sigma phải là hợp đồng bridge bắt buộc');

console.log('Sigma period record TypeScript bridge tests passed');
