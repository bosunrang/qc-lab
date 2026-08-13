'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','chart','cusum-colors.ts')).href;
const program=`import { CUSUM_COLORS } from ${JSON.stringify(source)};if(CUSUM_COLORS.cpos!=='#0e8f8f'||CUSUM_COLORS.cneg!=='#5369a6'||CUSUM_COLORS.threshold!==CUSUM_COLORS.reject||!Object.isFrozen(CUSUM_COLORS))throw new Error('must preserve CUSUM palette');console.log('CUSUM colors TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy CUSUM colors TypeScript');console.log(result.stdout.trim());
