'use strict';
const assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');const path=require('node:path');const{pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','dashboard','dashboard-missing-target-list-html.ts')).href;
const program=`import { createDashboardMissingTargetListHtml } from ${JSON.stringify(source)};const list=createDashboardMissingTargetListHtml({render:item=>item.id});if(list([{id:'a'},{id:'b'},{id:'c'},{id:'d'},{id:'e'}])!=='abcd')throw new Error('must preserve missing-target list limit');console.log('Dashboard missing target list HTML TypeScript tests passed');`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout||'không thể chạy dashboard missing target list TypeScript');console.log(result.stdout.trim());
