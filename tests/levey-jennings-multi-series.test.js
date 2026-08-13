'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-multi-series.ts')).href;
const program = `
  import { leveyJenningsMultiSeries } from ${JSON.stringify(source)};
  const model=leveyJenningsMultiSeries({views:[{level:1,mean:100,sd:2,pts:[{val:102,runId:'10',date:'2026-01-10'},{val:98,runId:'2',date:'2026-01-02'}]},{level:2,mean:0,sd:0,pts:[{val:1}]}],padLeft:56,width:866,markPad:10});
  if(model.levels.length!==1||model.all.map(item=>item.z).join(',')!=='1,-1'||model.runs.join(',')!=='2,10'||model.xOfRun('2')!==66||model.xOfRun('10')!==912)throw new Error('must filter valid levels and build numeric run axis');
  console.log('Levey-Jennings multi series TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings multi series TypeScript');
console.log(result.stdout.trim());
