'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-multi-dividers.ts')).href;
const program = `
  import { leveyJenningsMultiDividers } from ${JSON.stringify(source)};
  const runs=['r1','r2','r3','r4'],index=new Map(runs.map((run,i)=>[run,i]));
  const dividers=leveyJenningsMultiDividers([{pts:[{runId:'r1'},{runId:'r2'}]},{pts:[{runId:'r3'}]},{pts:[]}],runs,index,run=>index.get(run)*100);
  if(dividers.join(',')!=='150')throw new Error('must place divider midway between adjacent levels');
  console.log('Levey-Jennings multi dividers TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings multi dividers TypeScript');
console.log(result.stdout.trim());
