'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'cusum-point-render-model.ts')).href;
const program = `
  import { cusumPointRenderModel } from ${JSON.stringify(source)};
  const models=cusumPointRenderModel({indices:[1,2],points:[null,{id:'a'},{id:'b'}],cPos:[0,4,NaN],cNeg:[0,-3,-4],flags:['ok','rej','ok'],h:4,x:index=>index*10,clampY:value=>100-value,colors:{cpos:'P',cneg:'N',reject:'R'}});
  if(models.length!==2||models[0].x!==10||models[0].hoverY!==96||models[0].circles.map(circle=>circle.color+circle.radius).join(',')!=='R5,N3'||models[1].circles.length!==1||models[1].circles[0].color!=='N'||models[1].hoverY!==100)throw new Error('must prepare CUSUM circles, threshold styling and safe hover coordinate');
  console.log('CUSUM point render model TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy CUSUM point render model TypeScript');
console.log(result.stdout.trim());
