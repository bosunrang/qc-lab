'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const route=fs.readFileSync(path.join(root,'assets','modules','dashboard-routes.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const names=['dashboardStatusFilter','dashboardExpiringLots','dashboardShiftStatus','dashboardKpis','dashboardLevelData','dashboardTestAction','dashboardLevelPillsHtml'];
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required Dashboard bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
}
for(const name of ['dashboardStatusFilter','dashboardExpiringLots','dashboardShiftStatus','dashboardKpis'])assert.match(route,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the Dashboard route`);

console.log('Dashboard model TypeScript bridge tests passed');
