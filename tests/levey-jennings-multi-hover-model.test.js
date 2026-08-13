'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-multi-hover-model.ts')).href;
const program = `
  import { createLeveyJenningsMultiHoverModel } from ${JSON.stringify(source)};
  const html=createLeveyJenningsMultiHoverModel({date:value=>'D-'+value,escape:value=>'['+value+']',pointValue:point=>'V-'+point.val,number:value=>value.toFixed(1)})({point:{date:'2026-01-02',runId:'R1',lot:'L1',val:12},test:{unit:'U'},view:{level:2,lot:'L0'},z:-1.5,rules:['2-2s','R-4s']});
  if(!html.includes('D-2026-01-02 · Mức 2')||!html.includes('[R1]')||!html.includes('[L1]')||!html.includes('V-12 [U]')||!html.includes('Z: -1.5s')||!html.includes('[2-2s, R-4s]'))throw new Error('must preserve multi-level hover content');
  console.log('Levey-Jennings multi hover model TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings multi hover model TypeScript');
console.log(result.stdout.trim());
