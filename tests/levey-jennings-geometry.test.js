'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-geometry.ts')).href;
const program = `
  import { leveyJenningsGeometry } from ${JSON.stringify(source)};
  const g=leveyJenningsGeometry({width:1000,height:500,count:3,mean:100,sd:10});
  if(g.cw!==866||g.ch!==418||g.y(100)!==243||g.x(0)!==66||g.x(2)!==912)throw new Error('geometry must retain chart layout');
  if(g.clampY(1000)!==34||g.clampY(-1000)!==452)throw new Error('point coordinates must clamp to plot area');
  const one=leveyJenningsGeometry({width:1000,height:500,count:1,mean:100,sd:10});
  if(one.x(0)!==489)throw new Error('single point must remain centered');
  console.log('Levey-Jennings geometry TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings geometry TypeScript');
console.log(result.stdout.trim());
