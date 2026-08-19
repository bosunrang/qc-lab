'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const io=fs.readFileSync(path.join(root,'src','presentation','export','data-io-controller.ts'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
// reportXlsxStyles/reportXlsxDrawing/reportXlsxSheet stay required bridge contracts (reportXlsxBuild
// composes them internally via root.X) but are no longer read directly by data-io-controller.ts —
// the classic data-io.js only ever assigned them to local consts it never used (dead reads, dropped
// when this route retired the file), reportXlsxBuild already closes over root.X itself.
const bridgeOnlyNames=['reportXlsxStyles','reportXlsxDrawing','reportXlsxSheet'];
const names=['renameSigmaXlsxSheet','xlsxCells','xlsxZip','xlsxPeriodNumber','xlsxDrawing','sigmaXlsxStyles','reportXlsxBuild','reportXlsxHeader','westgardXlsxHeader','westgardXlsxRows','xlsxEscape','reportXlsxStyleIds','xlsxColumns','xlsxEmu','xlsxUtf8','xlsxRound'];
for(const name of [...names,...bridgeOnlyNames]){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required XLSX bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
}
for(const name of names){
  assert.match(io,new RegExp(`deps\\.${name}`),`${name} must be consumed by the XLSX exporter`);
}
assert.match(io,/deps\.westgardXlsxHeader\(/,'Westgard XLSX phải gọi trực tiếp header TypeScript');
assert.match(io,/deps\.westgardXlsxRows\.detail\(o, index\)/,'Westgard XLSX phải gọi trực tiếp row renderer TypeScript');
assert.doesNotMatch(io,/if\s*\(\s*deps\.westgardXlsxHeader\s*\)/,'Westgard XLSX không được giữ fallback header classic');
assert.doesNotMatch(io,/deps\.westgardXlsxRows\s*\?\s*deps\.westgardXlsxRows\.detail/,'Westgard XLSX không được giữ fallback row classic');

console.log('XLSX TypeScript bridge tests passed');
