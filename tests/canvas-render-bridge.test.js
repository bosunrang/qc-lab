'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const draw=fs.readFileSync(path.join(root,'src','presentation','chart','qc-chart-renderer.ts'),'utf8');
const io=fs.readFileSync(path.join(root,'src','presentation','export','data-io-controller.ts'),'utf8');
const afterRender=fs.readFileSync(path.join(root,'src','presentation','render','after-render-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
// afterRenderCanvasService is consumed through dependency injection (passed as
// `canvas:` into createAfterRenderController in the bridge wiring) rather than
// read as `globalThis.X` inside the TS controller itself — domain/presentation
// code must not read globals directly (see CLAUDE.md architecture rules), so
// its "consumed" evidence lives in the bridge wiring, not in the controller source.
for(const [name,source,consumed] of [
  ['canvasFont',draw,new RegExp('deps\\.canvasFont')],
  ['chartDataUrl',draw,new RegExp('deps\\.chartDataUrl')],
  ['afterRenderCanvasService',bridge,/canvas:root\.afterRenderCanvasService/],
  ['sigmaCanvasFactory',io,new RegExp('deps\\.sigmaCanvasFactory')],
  ['sigmaChartRenderer',io,new RegExp('deps\\.sigmaChartRenderer')],
  ['sigmaMdcRenderer',io,new RegExp('deps\\.sigmaMdcRenderer')],
]){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required canvas bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(source,consumed,`${name} must be consumed by the canvas UI`);
}
assert.match(afterRender,/export function createAfterRenderController\(/,
  'after-render controller must be TypeScript source');
assert.doesNotMatch(afterRender,/globalThis\./,
  'after-render controller must receive canvas/state access via injected deps, not read globals directly');

console.log('Canvas renderer TypeScript bridge tests passed');
