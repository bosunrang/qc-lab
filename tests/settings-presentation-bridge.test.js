'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const settings=fs.readFileSync(path.join(root,'src','presentation','settings','settings-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(settings,/deps\.profileCommand\.saveLab\(\{ name: fieldValue\('labName'\)/,'Hồ sơ đơn vị phải dùng command TypeScript');
assert.match(bridge,/const labProfileService=createLabProfileService\(/,'Hồ sơ đơn vị phải là dependency nội bộ của command Settings');
assert.doesNotMatch(bridge,/root\.labProfileService\s*=/,'Hồ sơ đơn vị không được công bố facade khi không có caller classic');

console.log('Settings presentation TypeScript bridge tests passed');
