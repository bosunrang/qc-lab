'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'cusum-chart-geometry.ts')).href;
const program = `
  import { cusumChartGeometry } from ${JSON.stringify(source)};
  const g=cusumChartGeometry({width:1000,height:500,count:3,h:4,cPos:[1,8],cNeg:[-2],ma:[3]});
  if(g.cw!==866||g.ch!==434||g.peak!==8||g.y(0)!==251||g.x(0)!==66||g.x(2)!==912||g.clampY(999)!==34)throw new Error('must preserve CUSUM geometry and peak range');
  console.log('CUSUM chart geometry TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy CUSUM chart geometry TypeScript');
console.log(result.stdout.trim());
