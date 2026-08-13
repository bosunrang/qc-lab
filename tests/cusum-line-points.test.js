'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'cusum-line-points.ts')).href;
const program = `
  import { cusumLinePoints } from ${JSON.stringify(source)};
  const points=cusumLinePoints({indices:[0,1,3,4],values:[2,NaN,7,-1,4],x:index=>index*10,clampY:value=>100-value});
  if(points.map(point=>point.x+':'+point.y).join(',')!=='0:98,30:101,40:96')throw new Error('must omit non-finite CUSUM values and project remaining points');
  console.log('CUSUM line points TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy CUSUM line points TypeScript');
console.log(result.stdout.trim());
