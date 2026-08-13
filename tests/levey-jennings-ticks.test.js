'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-ticks.ts')).href;
const program = `
  import { createLeveyJenningsTicks } from ${JSON.stringify(source)};
  const ticks=createLeveyJenningsTicks(value=>'VN-'+value)([{date:'2026-01-03'},{date:'x'},{date:'2026-02-05'},{date:'2026-03-07'},{date:'2026-04-09'},{date:'2026-05-11'}]);
  if(ticks.map(t=>t.index).join(',')!=='0,1,3,4,5'||ticks[0].label!=='03/01'||ticks[1].label!=='VN-x')throw new Error('must preserve representative tick positions and labels');
  const single=createLeveyJenningsTicks(()=>'?')([{date:'2026-12-31'}]); if(single.length!==1||single[0].label!=='31/12')throw new Error('must support one point');
  console.log('Levey-Jennings ticks TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings ticks TypeScript');
console.log(result.stdout.trim());
