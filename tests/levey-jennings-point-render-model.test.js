'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-point-render-model.ts')).href;
const program = `
  import { createLeveyJenningsPointRenderModel } from ${JSON.stringify(source)};
  const model=createLeveyJenningsPointRenderModel({displayPlan:()=>[0,2],verdict:(test,rules)=>rules.length?'warn':'ok',style:status=>({color:status,radius:status==='ok'?4:5}),hover:input=>input.point.id+'|'+input.z+'|'+input.rules.join(',')});
  const rows=model({points:[{id:'a',val:10},{id:'b',val:11},{id:'c',val:12}],results:[null,null,{rules:['1-2s']}],zs:[0,1,2],width:600,x:index=>index*10,y:value=>value*2,test:{},lot:'L',levelText:'Mức 1'});
  if(rows.length!==2||rows[0].x!==0||rows[1].y!==24||rows[0].style.radius!==4||rows[1].style.color!=='warn'||rows[1].hover!=='c|2|1-2s')throw new Error('must combine display, verdict, style and hover models');
  console.log('Levey-Jennings point render model TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings point render model TypeScript');
console.log(result.stdout.trim());
