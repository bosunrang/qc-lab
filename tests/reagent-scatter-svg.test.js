'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-scatter-svg.ts');
const program = `import { reagentScatterSvg } from ${JSON.stringify(pathToFileURL(source).href)}; const html=reagentScatterSvg({o:[1,2],n:[1.5,2.5],pb:{a:0.2,b:1.1}},{lotOld:'A',lotNew:'B'},(min,max)=>[min-1,max+1],(w,h,xmin,xmax,ymin,ymax,x,y)=>({g:'<axis>'+x+'|'+y+'</axis>',px:v=>v*10,py:v=>v*20}),{muted:'#m',teal:'#t'}); console.log(html);`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<axis>Lô cũ \(A\)\|Lô mới \(B\)<\/axis>/);
assert.match(html, /stroke="#m" stroke-width="1\.4"/);
assert.match(html, /stroke="#t" stroke-width="2"/);
assert.equal((html.match(/<circle /g) || []).length, 2, 'Mỗi cặp phải tạo một điểm');
assert.match(html, /viewBox="0 0 460 380"/);

console.log('Reagent scatter SVG TypeScript tests passed');
