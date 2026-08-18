'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'src','presentation','westgard','westgard-page-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

for(const [name,type] of [
  ['westgardUiState','typeof westgardUiState'],
  ['westgardModeTabs','typeof westgardModeTabs'],
  ['westgardTestSearch','ReturnType<typeof createWestgardTestSearch<any>>'],
  ['westgardMultiViews','ReturnType<typeof createWestgardMultiViews<any, any>>'],
  ['westgardCusumLevels','ReturnType<typeof createWestgardCusumLevels<any, any, any>>'],
  ['westgardPointRowsHtml','ReturnType<typeof createWestgardPointRowsHtml<any>>'],
  ['westgardRowsControl','ReturnType<typeof createWestgardRowsControl>'],
  ['westgardCusumPageHtml','ReturnType<typeof createWestgardCusumPageHtml<any>>'],
  ['westgardLotBlockHtml','ReturnType<typeof createWestgardLotBlockHtml>'],
  ['westgardRuleGuideHtml','ReturnType<typeof createWestgardRuleGuideHtml>'],
  ['westgardRuleTogglesHtml','ReturnType<typeof createWestgardRuleTogglesHtml>'],
  ['westgardExportActionsHtml','ReturnType<typeof createWestgardExportActionsHtml>']
]){
  const escaped=type.replace(/[<>()[\]{}?+*.$^|\\]/g,'\\$&');
  assert.match(bridge,new RegExp(`${name}: ${escaped};`),`${name} must be a required Westgard bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(route,new RegExp(`deps\\.${name}`),`${name} must be consumed by the Westgard UI`);
}

console.log('Westgard renderer TypeScript bridge tests passed');
