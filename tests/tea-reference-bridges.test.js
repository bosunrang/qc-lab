'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),route=fs.readFileSync(path.join(root,'src/presentation/manage/manage-page-controller.ts'),'utf8'),bridge=fs.readFileSync(path.join(root,'src/compat/modular-pilot.global.ts'),'utf8');
for(const name of ['teaReferenceKindPresentation','teaReferenceRowActionsPresentation','teaReferenceSortPresentation','teaReferenceNamingTitlePresentation','teaReferenceEmptyStatePresentation','teaReferenceInputValuePresentation','teaReferenceLabProfileBodyPresentation']){assert.match(route,new RegExp(`deps\\.pres\\.${name}`));assert.match(bridge,new RegExp(`root\\.${name}=`));}
console.log('Tea reference bridge tests passed');
