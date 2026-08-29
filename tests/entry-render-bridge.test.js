'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','entry','entry-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const names=['entryRowsWindowTs','entryLotLabelsTs','entrySheetMonthPart','entrySheetMonthValue','entrySheetNavigation','entrySheetInputOrder','entryTreeNavigation','entrySheetFocus','entryColumnConfig','entryRangePreset','entryTreeCollapsePreference','entryTreeVisibility','entryTreeKeyCommand','entrySelectionState','entryExpandedTablesToggle','entryVoidNceChoice','entryVoidReasonValid','entryRecordErrorMessage','entrySaveFeedback','entryExtraRunRequest','entryDateNoteFeedback','entryDateNoteErrorMessage','entryDateRangeInput','entryVoidModalHtml','entryPreSaveWarningModalHtml'];
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Entry bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(route,new RegExp(`deps\\.pres\\.${name}`),`${name} must be consumed by the Entry route`);
}
assert.match(bridge,/pointContext: \(testId, level, lot, activeLot\).*entryPointContext/s,'EntryRecordCommand must retain the shared point-context presentation contract');
assert.doesNotMatch(bridge,/root\.entryPointContext\s*=/,'Entry point context phải là dependency nội bộ của command TypeScript');

console.log('Entry renderer TypeScript bridge tests passed');
