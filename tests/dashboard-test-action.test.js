'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','dashboard','dashboard-test-action.ts')).href;
const program=`import { createDashboardTestAction } from ${JSON.stringify(source)};const action=createDashboardTestAction({button:(label,code,variant)=>label+'|'+JSON.stringify(code)+'|'+variant});if(action('T1',2)!=='Xem QC|{"action":"dashViewTestInEntry","args":["T1",2]}|ghost sm')throw new Error('must preserve dashboard test action');console.log('Dashboard test action TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy dashboard test action TypeScript');console.log(result.stdout.trim());
