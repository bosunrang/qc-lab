'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const controller=fs.readFileSync(path.join(root,'src','presentation','render','after-render-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
for(const name of ['configNavScrollService','entryJumpScrollService','defaultDateFieldsService','postRenderPageActions']){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required post-render bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
}
assert.match(controller,/export function createAfterRenderController\(/,'after-render controller phải nằm trong TypeScript');
assert.match(bridge,/root\.afterRender\s*=\s*createAfterRenderController\(/,'bootstrap phải công bố controller cho route legacy còn lại');
assert.doesNotMatch(bridge,/afterRenderCanvasService\.queueCanvasDraw/,'không công bố wrapper canvas classic không còn caller');

console.log('After-render TypeScript bridge tests passed');
