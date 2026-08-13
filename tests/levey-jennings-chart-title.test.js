'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','chart','levey-jennings-chart-title.ts')).href;
const program=`import { LEVEY_JENNINGS_CHART_TITLE } from ${JSON.stringify(source)};if(LEVEY_JENNINGS_CHART_TITLE.single!=='Levey-Jennings'||LEVEY_JENNINGS_CHART_TITLE.multi!=='Levey-Jennings tổng hợp theo Z-score'||!Object.isFrozen(LEVEY_JENNINGS_CHART_TITLE))throw new Error('must preserve Levey-Jennings chart titles');console.log('Levey-Jennings chart title TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy Levey-Jennings chart title TypeScript');console.log(result.stdout.trim());
