'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),route=fs.readFileSync(path.join(root,'assets/modules/manage-routes.js'),'utf8'),bridge=fs.readFileSync(path.join(root,'src/compat/modular-pilot.global.ts'),'utf8');
for(const name of ['teaReferenceKindPresentation','teaReferenceRowActionsPresentation','teaReferenceSortPresentation','teaReferenceNamingTitlePresentation','teaReferenceEmptyStatePresentation','teaReferenceLabValuePresentation','teaReferenceInputValuePresentation']){assert.match(route,new RegExp(`globalThis\\.${name}`));assert.match(bridge,new RegExp(`root\\.${name}=`));}
console.log('Tea reference bridge tests passed');
