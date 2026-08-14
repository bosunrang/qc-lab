'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const io=fs.readFileSync(path.join(root,'assets','modules','data-io.js'),'utf8');
const reports=fs.readFileSync(path.join(root,'assets','modules','reports.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const names=['sigmaReportMetricService','sigmaMdcItemsService','sigmaMdcLabelPlacementService','sigmaExportPixelRatioService','sigmaReportRowsService','sigmaExportMetaService','exportMetaRowsService','qcExportValueFormat','sigmaCanvasFont','sigmaMuTraceService','sigmaPrintRowsService','sigmaMuPrintRowsService'];
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Sigma export bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(name.includes('Print')||name==='sigmaMuTraceService'?reports:io,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the export or print UI`);
}

console.log('Sigma export TypeScript bridge tests passed');
