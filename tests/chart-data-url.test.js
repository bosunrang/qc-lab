'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'chart-data-url.ts')).href;
const program = `
  import { createChartDataUrl } from ${JSON.stringify(source)};
  const canvas={width:0,height:0,toDataURL:type=>type+':'+canvas.width+'x'+canvas.height};let rendered=null;
  const url=createChartDataUrl({createCanvas:()=>canvas})({width:1400,height:430,render:value=>{rendered=value;}});
  if(url!=='image/png:1400x430'||rendered!==canvas)throw new Error('must size a supplied canvas, render it and export PNG');
  console.log('Chart data URL TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy chart data URL TypeScript');
console.log(result.stdout.trim());
