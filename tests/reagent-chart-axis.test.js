'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const source = path.join(__dirname, '..', 'src', 'presentation', 'reagent', 'reagent-chart-axis.ts');
const program = `import { reagentChartAxis } from ${JSON.stringify(pathToFileURL(source).href)}; const axis=reagentChartAxis(100,80,0,10,0,20,'X<lab>','Y', {grid:'#g',muted:'#m',ink:'#i'}, {l:10,r:10,t:5,b:10}, value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;')); console.log(JSON.stringify({g:axis.g,px:[axis.px(0),axis.px(10)],py:[axis.py(0),axis.py(20)]}));`;
const output = JSON.parse(execFileSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', program], { encoding: 'utf8' }));

assert.deepEqual(output.px, [10, 90]);
assert.deepEqual(output.py, [70, 5]);
assert.equal((output.g.match(/stroke="#g"/g) || []).length, 12, 'Phải dựng 6 đường dọc và 6 đường ngang');
assert.match(output.g, /X&lt;lab&gt;/, 'Nhãn trục phải được escape');
assert.match(output.g, /rotate\(-90\)/);

console.log('Reagent chart axis TypeScript tests passed');
