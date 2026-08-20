'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(bridge,/root\.actionProtocolStatus\s*=\s*action\s*=>\s*root\.ActionProtocolService!\.protocolStatus\(action\)/,'Giao thức NCE phải dùng service TypeScript');
assert.match(bridge,/root\.actionRerunStatus\s*=\s*action\s*=>\s*root\.ActionRerunService!\.status\(action\)/,'Chạy lại QC NCE phải dùng service TypeScript');
assert.match(bridge,/ActionProtocolService: ActionProtocolService;/,'Giao thức NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionRerunService: ActionRerunService;/,'Chạy lại QC NCE phải là hợp đồng bridge bắt buộc');

console.log('Action protocol and rerun TypeScript bridge tests passed');
