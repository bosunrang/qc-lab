'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const draw=fs.readFileSync(path.join(root,'assets','modules','draw.js'),'utf8');
const io=fs.readFileSync(path.join(root,'assets','modules','data-io.js'),'utf8');
const afterRender=fs.readFileSync(path.join(root,'assets','modules','after-render.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
for(const [name,source] of [['canvasFont',draw],['chartDataUrl',draw],['afterRenderCanvasService',afterRender],['sigmaCanvasFactory',io],['sigmaChartRenderer',io],['sigmaMdcRenderer',io]]){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required canvas bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(source,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the canvas UI`);
}

console.log('Canvas renderer TypeScript bridge tests passed');
