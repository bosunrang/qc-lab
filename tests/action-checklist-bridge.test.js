'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const form=fs.readFileSync(path.join(root,'src','presentation','actions','action-form-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(form,/const actionSectionChip = \(missing: unknown\) => deps\.ActionChecklistPresentation\.sectionChip\(missing\);/,'Chip mục NCE phải dùng bridge TypeScript');
assert.match(form,/const actionInvestigationChoiceLabel = \(value: unknown, label: unknown\) => deps\.ActionInvestigationPresentation\.choiceLabel\(value, label\);/,'Nhãn kiểm tra NCE phải dùng bridge TypeScript');
assert.match(form,/const actionInvestigationStateClass = \(value: unknown\) => deps\.ActionInvestigationPresentation\.stateClass\(value\);/,'Trạng thái kiểm tra NCE phải dùng bridge TypeScript');
assert.match(form,/const actionChecklistChip = \(form: AnyRec\) => deps\.ActionChecklistPresentation\.checklistChip\(/,'Chip checklist NCE phải dùng bridge TypeScript');
assert.match(form,/const actionEffSectionChip = \(form: AnyRec\) => deps\.ActionChecklistPresentation\.effectivenessChip\(form\);/,'Chip hiệu lực NCE phải dùng bridge TypeScript');
assert.match(bridge,/ActionChecklistPresentation: ActionChecklistPresentation;/,'Trình bày checklist NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/ActionInvestigationPresentation: ActionInvestigationPresentation;/,'Trình bày kiểm tra NCE phải là hợp đồng bridge bắt buộc');

console.log('Action checklist TypeScript bridge tests passed');
