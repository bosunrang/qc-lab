'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'levey-jennings-hover-model.ts')).href;
const program = `
  import { createLeveyJenningsHoverModel } from ${JSON.stringify(source)};
  const html=createLeveyJenningsHoverModel({date:value=>'D-'+value,escape:value=>'['+value+']',pointValue:point=>'V-'+point.val,number:value=>value.toFixed(2)})({point:{date:'2026-01-02',lot:'L1',val:12},test:{unit:'U'},lot:'L0',levelText:'Mức 1',z:1.25,rules:['1-2s']});
  if(!html.includes('D-2026-01-02 · Mức 1')||!html.includes('[L1]')||!html.includes('V-12 [U]')||!html.includes('Z: +1.25s')||!html.includes('[1-2s]'))throw new Error('must preserve hover content');
  const clear=createLeveyJenningsHoverModel({date:value=>value,escape:value=>value,pointValue:()=>'',number:value=>String(value)})({point:{date:'d',lot:'',val:0},test:{},lot:'fallback',levelText:'QC',z:-1,rules:[]});
  if(!clear.includes('Z: -1s')||!clear.includes('Lô: <b style="display:inline">fallback')||!clear.includes('Luật: Đạt'))throw new Error('must preserve fallback lot and accepted label');
  console.log('Levey-Jennings hover model TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy Levey-Jennings hover model TypeScript');
console.log(result.stdout.trim());
