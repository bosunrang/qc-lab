'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const form=fs.readFileSync(path.join(root,'assets','modules','action-form.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(form,/return ActionBiasService\.info\(t,l,biasBeforeRaw,biasAfterRaw\);/,'Đánh giá Bias NCE phải dùng service TypeScript');
assert.match(form,/return ActionBiasService\.latestSigmaBias\(t,level,state\.sigmaData\);/,'Bias Sigma NCE phải dùng service TypeScript');
assert.match(form,/return ActionBiasPresentation\.thresholdHtml\(info\);/,'Ngưỡng Bias NCE phải dùng presentation TypeScript');
assert.match(bridge,/ActionBiasService: ActionBiasService;/,'Đánh giá Bias NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionBiasPresentation: ActionBiasPresentation;/,'Trình bày Bias NCE phải là hợp đồng bridge bắt buộc');

console.log('Action bias TypeScript bridge tests passed');
