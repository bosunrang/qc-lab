'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-display-plan.ts')).href;
const program = `
  import { createLeveyJenningsDisplayPlan } from ${JSON.stringify(source)};
  let input=null;const plan=createLeveyJenningsDisplayPlan(value=>{input=value;return [0,3,9];});
  const result=plan([{val:1},{val:2},{val:3},{val:4},{val:5},{val:6},{val:7},{val:8},{val:9},{val:10}],[null,{rules:[]},{rules:['1-2s']},null,null,null,null,{rules:['2-2s']},null,null],300);
  if(result.join(',')!=='0,3,9'||input.maxPoints!==240||input.preserve.join(',')!=='2,7'||input.valueAt(3)!==4)throw new Error('must preserve Westgard points and display budget');
  console.log('Levey-Jennings display plan TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings display plan TypeScript');
console.log(result.stdout.trim());
