'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'cusum-display-plan.ts')).href;
const program = `
  import { createCusumDisplayPlan } from ${JSON.stringify(source)};
  const calls=[];const plan=createCusumDisplayPlan(input=>{calls.push(input);return input===calls[0]?[8,2,5]:input===calls[1]?[1,5,9]:[0,2,7];});
  const result=plan({count:10,width:600,cPos:[1],cNeg:[2],ma:[3],flags:['ok','rej','ok','ok','ok','rej','ok','ok','ok','ok']});
  if(result.join(',')!=='0,1,2,5,7,8,9'||calls.length!==3||calls.some(call=>call.maxPoints!==100||call.preserve.join(',')!=='1,5')||calls[1].valueAt(0)!==2||calls[2].valueAt(0)!==3)throw new Error('must preserve rejected CUSUM points, plan each series and return sorted union');
  console.log('CUSUM display plan TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy CUSUM display plan TypeScript');
console.log(result.stdout.trim());
