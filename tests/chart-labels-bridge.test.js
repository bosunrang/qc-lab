'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const draw=fs.readFileSync(path.join(root,'src','presentation','chart','qc-chart-renderer.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
for(const name of ['cusumColors','leveyJenningsMultiColors','cusumChartTitle','leveyJenningsChartTitle','chartEmptyLabels','leveyJenningsMultiYAxis','leveyJenningsMultiGeometry']){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required chart label bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(draw,new RegExp(`deps\\.${name}`),`${name} must be consumed by the chart renderer`);
}

console.log('Chart labels TypeScript bridge tests passed');
