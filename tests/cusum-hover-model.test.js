'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'cusum-hover-model.ts')).href;
const program = `
  import { createCusumHoverModel } from ${JSON.stringify(source)};
  const hover=createCusumHoverModel({date:value=>'D-'+value,number:(value,decimals)=>value.toFixed(decimals)});
  const rejected=hover({point:{date:'2026-08-13'},cPos:2.5,cNeg:-1.25,rejected:true});
  const clear=hover({point:{date:'2026-08-14'},cPos:0,cNeg:0,rejected:false});
  if(!rejected.includes('D-2026-08-13')||!rejected.includes('CUSUM+: 2.50')||!rejected.includes('CUSUM−: -1.25')||!rejected.includes('Vượt ngưỡng h')||!clear.includes('Trong tầm kiểm soát'))throw new Error('must preserve CUSUM hover content');
  console.log('CUSUM hover model TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy CUSUM hover model TypeScript');
console.log(result.stdout.trim());
