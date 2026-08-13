'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-multi-run-ticks.ts')).href;
const program = `
  import { createLeveyJenningsMultiRunTicks } from ${JSON.stringify(source)};
  const ticks=createLeveyJenningsMultiRunTicks(value=>'VN-'+value)(['r1','r2','r3','r4','r5','r6'],[{run:'r1',date:'2026-01-02'},{run:'r2',date:'x'},{run:'r3',date:'2026-01-04'},{run:'r4',date:'2026-01-05'},{run:'r5',date:'2026-01-06'},{run:'r6',date:'2026-01-07'}]);
  if(ticks.map(tick=>tick.run).join(',')!=='r1,r2,r4,r5,r6'||ticks[0].label!=='02/01'||ticks[1].label!=='VN-x')throw new Error('must select and label representative runs');
  console.log('Levey-Jennings multi run ticks TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings multi run ticks TypeScript');
console.log(result.stdout.trim());
