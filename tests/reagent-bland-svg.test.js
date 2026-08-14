'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-bland-svg.ts');
const program = `import { reagentBlandSvg } from ${JSON.stringify(pathToFileURL(source).href)}; const html=reagentBlandSvg({o:[1,3],n:[2,4],d:[-1,-1],md:-1,sdd:0.5},(min,max)=>[min,max],(w,h,xmin,xmax,ymin,ymax,x,y)=>({g:'<axis>'+x+'|'+y+'</axis>',px:v=>v*10,py:v=>v*20}),{line:'#l',amber:'#a',red:'#r'}); console.log(html);`;
const html = execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' });

assert.match(html, /<axis>Trung bình \(cũ \+ mới\)\/2\|Hiệu số \(cũ − mới\)<\/axis>/);
assert.match(html, /Bias -1/);
assert.match(html, /\+1\.96SD -0\.02/);
assert.match(html, /−1\.96SD -1\.98/);
assert.equal((html.match(/<circle /g) || []).length, 2);
assert.match(html, /stroke="#l"/);

console.log('Reagent Bland SVG TypeScript tests passed');
