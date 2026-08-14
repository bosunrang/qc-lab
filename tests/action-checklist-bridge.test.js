'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const form=fs.readFileSync(path.join(root,'assets','modules','action-form.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(form,/function actionSectionChip\(missing\)\{\s*return globalThis\.ActionChecklistPresentation\.sectionChip\(missing\);/,'Chip mục NCE phải dùng bridge TypeScript');
assert.match(form,/function actionInvestigationChoiceLabel\(value,label\)\{return globalThis\.ActionInvestigationPresentation\.choiceLabel\(value,label\);\}/,'Nhãn kiểm tra NCE phải dùng bridge TypeScript');
assert.match(form,/function actionInvestigationStateClass\(value\)\{return globalThis\.ActionInvestigationPresentation\.stateClass\(value\);\}/,'Trạng thái kiểm tra NCE phải dùng bridge TypeScript');
assert.match(form,/function actionChecklistChip\(form\)\{\s*return globalThis\.ActionChecklistPresentation\.checklistChip\(/,'Chip checklist NCE phải dùng bridge TypeScript');
assert.match(form,/function actionEffSectionChip\(form\)\{\s*return globalThis\.ActionChecklistPresentation\.effectivenessChip\(form\);/,'Chip hiệu lực NCE phải dùng bridge TypeScript');
assert.match(bridge,/ActionChecklistPresentation: ActionChecklistPresentation;/,'Trình bày checklist NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionInvestigationPresentation: ActionInvestigationPresentation;/,'Trình bày kiểm tra NCE phải là hợp đồng bridge bắt buộc');

console.log('Action checklist TypeScript bridge tests passed');
