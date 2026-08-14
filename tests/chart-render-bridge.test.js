'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const draw=fs.readFileSync(path.join(root,'assets','modules','draw.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');

const names=['chartTooltipService','qcTooltip','leveyJenningsTooltipController','hiDpiCanvasSetup','leveyJenningsGeometry','westgardRuleScope','leveyJenningsColors','leveyJenningsTicks','leveyJenningsYAxisLabels','leveyJenningsHoverModel','leveyJenningsPointStyle','leveyJenningsDisplayPlan','leveyJenningsPointRenderModel','leveyJenningsBandRects','leveyJenningsGridLines','leveyJenningsMultiSeries','leveyJenningsMultiRunTicks','leveyJenningsLegendLayout','leveyJenningsMultiDisplayPlan','leveyJenningsMultiHoverModel','leveyJenningsMultiPointRenderModel','leveyJenningsMultiDividers','cusumChartGeometry','cusumDisplayPlan','cusumHoverModel','cusumPointRenderModel','cusumReferenceLines','cusumLinePoints'];
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required chart bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}=`),`${name} must be assigned by the TypeScript bootstrap`);
}
for(const name of names.filter(name=>draw.includes(`globalThis.${name}`))){
  assert.match(draw,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the canvas renderer`);
}

console.log('Chart renderer TypeScript bridge tests passed');
