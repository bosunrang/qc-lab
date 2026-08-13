'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const source = pathToFileURL(path.join(__dirname, '..', 'src', 'presentation', 'render', 'visible-canvas-service.ts')).href;
const program = `
  import { createVisibleCanvasService } from ${JSON.stringify(source)};
  const frames=[],observed=[],disconnected=[];
  const service=createVisibleCanvasService({
    requestFrame:work=>{frames.push(work);return frames.length;},
    intersectionObserver:onVisible=>({observe:canvas=>observed.push(['intersection',canvas]),disconnect:()=>disconnected.push('intersection')}),
    resizeObserver:onResize=>({observe:canvas=>{observed.push(['resize',canvas]);canvas.resize=onResize;},disconnect:()=>disconnected.push('resize')}),
    isConnected:canvas=>canvas.isConnected!==false,
  });
  let draws=0; const canvas={isConnected:true,getBoundingClientRect:()=>({width:320})};
  service.drawVisibleCanvas(canvas,()=>{draws++;});
  if(observed.length!==2||frames.length!==0)throw new Error('observer setup must defer the first draw');
  canvas.resize(); if(frames.length!==1)throw new Error('resize must queue one draw');
  service.queueCanvasDraw(canvas); if(frames.length!==1)throw new Error('draw queue must coalesce frames');
  frames.shift()(); if(draws!==1)throw new Error('queued draw must run once');
  canvas.resize(); canvas.getBoundingClientRect=()=>({width:320}); if(frames.length!==0)throw new Error('unchanged width must not redraw');
  canvas.getBoundingClientRect=()=>({width:480}); canvas.resize(); frames.shift()(); if(draws!==2)throw new Error('changed width must redraw');
  canvas.isConnected=false; service.queueCanvasDraw(canvas); frames.shift()(); if(draws!==2)throw new Error('detached canvas must not draw');
  service.disconnectObservers(); if(disconnected.join(',')!=='intersection,resize')throw new Error('all observers must disconnect');
  console.log('Visible canvas service TypeScript tests passed');
`;
const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--eval', program], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout || 'không thể chạy visible canvas service TypeScript');
console.log(result.stdout.trim());
