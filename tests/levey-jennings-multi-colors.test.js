'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','chart','levey-jennings-multi-colors.ts')).href;
const program=`import { LEVEY_JENNINGS_MULTI_COLORS } from ${JSON.stringify(source)};if(JSON.stringify(LEVEY_JENNINGS_MULTI_COLORS)!==JSON.stringify(['#0e8f8f','#7a4f9a','#c47d12','#2f7d5b','#5369a6','#9a5b3c'])||!Object.isFrozen(LEVEY_JENNINGS_MULTI_COLORS))throw new Error('must preserve multi-level palette');console.log('Levey-Jennings multi colors TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy Levey-Jennings multi colors TypeScript');console.log(result.stdout.trim());
