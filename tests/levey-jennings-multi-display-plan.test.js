'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-multi-display-plan.ts')).href;
const program = `
  import { createLeveyJenningsMultiDisplayPlan } from ${JSON.stringify(source)};
  let input=null;const plan=createLeveyJenningsMultiDisplayPlan(value=>{input=value;return [0,2,3];});const points=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
  const result=plan({points,single:{F:[null,{rules:['1-2s']},null,null],zs:[1,2,3,4]},cross:new Map([[points[3],['2-2s']]]),width:900,levelCount:3});
  if(result.join(',')!=='0,2,3'||input.maxPoints!==300||input.preserve.join(',')!=='1,3'||input.valueAt(2)!==3)throw new Error('must preserve within and across-rule points');
  console.log('Levey-Jennings multi display plan TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings multi display plan TypeScript');
console.log(result.stdout.trim());
