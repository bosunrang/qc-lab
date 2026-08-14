'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','entry-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const names=['entryRowsWindowTs','entryLotLabelsTs','entryDayPresetButtons','entryLeveyJenningsMiniHtml','entrySheetLevelHeads','entrySheetMonthPart','entrySheetMonthValue','entryTreeState','entrySheetNavigation','entrySheetInputOrder','entryTreeGroupState','entryTreeNavigation','entrySheetFocus','entryColumnConfig','entryRangePreset','entryTreeCollapsePreference','entryTreeVisibility','entryTreeKeyCommand','entrySelectionState','entryExpandedTablesToggle','entryPointContext','entryVoidNceChoice','entryVoidReasonValid','entryRecordErrorMessage','entrySaveFeedback','entryExtraRunRequest','entryDateNoteFeedback','entryDateNoteErrorMessage','entryDateRangeInput'];
names.push('entryTreeHeaderHtml','entryTreeItemHtml','entryRangeSummaryHtml','entryWorksheetHtml','entryLeveyPanelHtml','entryPageLayoutHtml','entryVoidedPointsHtml','entryPointsPanelHtml','entryCumulativeStatsHtml','entryTableWindowNoteHtml','entryPointTableCardHtml','entryPointTableRowHtml','entryVoidedPointRowHtml','entrySheetDayRowHtml','entrySheetDaySummaryHtml','entryVoidModalHtml','entryPreSaveWarningModalHtml','entrySheetEmptyRunHtml','entrySheetSavedRunHtml','entrySheetCellHtml','entrySheetAddRunHtml','entrySheetNoteHtml','entryEmptyPageHtml');
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Entry bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(route,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the Entry route`);
}

console.log('Entry renderer TypeScript bridge tests passed');
