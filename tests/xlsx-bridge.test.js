'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const io=fs.readFileSync(path.join(root,'assets','modules','data-io.js'),'utf8');
const bridge=fs.readFileSync(path.join(root,'src','compat','modular-pilot.global.ts'),'utf8');
const names=['renameSigmaXlsxSheet','xlsxCells','xlsxZip','xlsxPeriodNumber','xlsxDrawing','sigmaXlsxStyles','reportXlsxStyles','reportXlsxDrawing','reportXlsxSheet','reportXlsxBuild','reportXlsxHeader','westgardXlsxHeader','westgardXlsxRows','xlsxEscape','reportXlsxStyleIds','xlsxColumns','xlsxEmu','xlsxUtf8','xlsxRound'];
for(const name of names){
  assert.match(bridge,new RegExp(`^  ${name}:`,'m'),`${name} must be a required XLSX bridge contract`);
  assert.match(bridge,new RegExp(`root\\.${name}\\s*=`),`${name} must be assigned by the TypeScript bootstrap`);
  assert.match(io,new RegExp(`globalThis\\.${name}`),`${name} must be consumed by the XLSX exporter`);
}
assert.match(io,/const h=globalThis\.westgardXlsxHeader\(/,'Westgard XLSX phải gọi trực tiếp header TypeScript');
assert.match(io,/const row=globalThis\.westgardXlsxRows\.detail\(o,index\)/,'Westgard XLSX phải gọi trực tiếp row renderer TypeScript');
assert.doesNotMatch(io,/if\(globalThis\.westgardXlsxHeader\)/,'Westgard XLSX không được giữ fallback header classic');
assert.doesNotMatch(io,/globalThis\.westgardXlsxRows\?globalThis\.westgardXlsxRows\.detail/,'Westgard XLSX không được giữ fallback row classic');

console.log('XLSX TypeScript bridge tests passed');
