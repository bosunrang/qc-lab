'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','chart','cusum-chart-title.ts')).href;
const program=`import { createCusumChartTitle } from ${JSON.stringify(source)};const title=createCusumChartTitle({format:(value,digits)=>value.toFixed(digits)});if(title(.5,4)!=='CUSUM xu hướng (k=0.50, h=4.00)')throw new Error('must preserve CUSUM title');console.log('CUSUM chart title TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy CUSUM chart title TypeScript');console.log(result.stdout.trim());
