'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','actions','actions-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

assert.match(route,/return deps\.pres\.actionDetailCheckHtml\(label, view, note\);/,'Chi tiết kiểm tra NCE phải dùng bridge TypeScript');
assert.match(route,/return deps\.pres\.actionEvidenceTimelinePresentation\(items\);/,'Timeline bằng chứng NCE phải dùng bridge TypeScript');
assert.match(bridge,/actionDetailCheckHtml: ReturnType<typeof createActionDetailCheckHtml>;/,'Chi tiết kiểm tra NCE phải là hợp đồng bridge bắt buộc');
assert.match(bridge,/actionEvidenceTimelinePresentation: ReturnType<typeof createActionEvidenceTimelineHtml>;/,'Timeline NCE phải là hợp đồng bridge bắt buộc');

for(const [name,type] of [
  ['actionRerunEvidencePresentation','ReturnType<typeof createActionRerunEvidenceHtml<any>>'],
  ['actionDetailMetaHtml','ReturnType<typeof createActionDetailMetaHtml>'],
  ['actionCancelledAlertHtml','ReturnType<typeof createActionCancelledAlertHtml>'],
  ['actionLegacyDetailHtml','ReturnType<typeof createActionLegacyDetailHtml>'],
  ['actionContainmentDetailHtml','ReturnType<typeof createActionContainmentDetailHtml>'],
  ['actionInspectionDetailsHtml','ReturnType<typeof createActionInspectionDetailsHtml>'],
  ['actionPatientImpactHtml','ReturnType<typeof createActionPatientImpactHtml>'],
  ['actionCauseDetailHtml','ReturnType<typeof createActionCauseDetailHtml>'],
  ['actionEffectivenessDetailHtml','ReturnType<typeof createActionEffectivenessDetailHtml>']
]){
  assert.match(bridge,new RegExp(`${name}: ${type.replace(/[<>()[\]{}?+*.$^|\\]/g,'\\$&')};`),`${name} must be a required NCE bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}=`),`${name} must be assigned by the TypeScript bootstrap`);
}

console.log('Action detail TypeScript bridge tests passed');
