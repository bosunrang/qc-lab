'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-multi-point-render-model.ts')).href;
const program = `
  import { createLeveyJenningsMultiPointRenderModel } from ${JSON.stringify(source)};
  const model=createLeveyJenningsMultiPointRenderModel({displayPlan:()=>[0,1],verdict:(test,rules)=>rules.length?'warn':'ok',hover:input=>input.point.id+'|'+input.rules.join(',')});
  const points=[{id:'a',runId:'R1'},{id:'b',runId:'R2'}],rows=model({points,single:{F:[null,{rules:['1-2s']}],zs:[0,2]},cross:new Map([[points[1],['2-2s']]]),width:600,levelCount:2,x:run=>run==='R1'?10:20,y:z=>z*5,test:{},view:{level:1},color:'teal'});
  if(rows[0].color!=='teal'||rows[0].radius!==4.2||rows[1].color!=='#dd8b1f'||rows[1].radius!==5.4||rows[1].hover!=='b|1-2s,2-2s'||rows[1].x!==20||rows[1].y!==10)throw new Error('must combine multi-level display, verdict, geometry and hover');
  console.log('Levey-Jennings multi point render model TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings multi point render model TypeScript');
console.log(result.stdout.trim());
