'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'chart', 'hi-dpi-canvas.ts')).href;
const program = `
  import { createHiDpiCanvasSetup } from ${JSON.stringify(source)};
  const transforms=[],canvas={dataset:{renderScale:'1'},width:1400,height:430,clientWidth:800,style:{},getAttribute:key=>key==='width'?'1400':null,getContext:()=>({setTransform:(...args)=>transforms.push(args)})};
  const setup=createHiDpiCanvasSetup(()=>2),result=setup(canvas);
  if(result.W!==800||result.H!==246||canvas.width!==1600||canvas.height!==492||canvas.style.height!=='246px')throw new Error('must preserve aspect ratio and scale backing pixels');
  if(transforms.length!==1||transforms[0][0]!==2||canvas.dataset.baseW!=='1400')throw new Error('must cache baseline and set transform');
  canvas.clientWidth=0;canvas.dataset.renderScale='4';setup(canvas);
  if(canvas.width!==2800||transforms[1][0]!==2)throw new Error('render scale must cap at 2 while preserving base width');
  console.log('HiDPI canvas TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy HiDPI canvas TypeScript');
console.log(result.stdout.trim());
