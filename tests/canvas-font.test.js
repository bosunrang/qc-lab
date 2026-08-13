'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'canvas-font.ts')).href;
const program = `
  import { createCanvasFont } from ${JSON.stringify(source)};
  const calls=[];const font=createCanvasFont((token,fallback)=>{calls.push([token,fallback]);return 12.5;});
  if(font(800,'type-caption',11.5)!=='800 12.5px Manrope, Arial, sans-serif'||font(0,'type-meta',10)!=='12.5px Manrope, Arial, sans-serif'||calls.map(call=>call.join(':')).join(',')!=='type-caption:11.5,type-meta:10')throw new Error('must build canvas font with injected CSS token lookup');
  console.log('Canvas font TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy canvas font TypeScript');
console.log(result.stdout.trim());
