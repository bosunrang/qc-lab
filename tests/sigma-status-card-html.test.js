'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','presentation','sigma','sigma-status-card-html.ts')).href;
const program=`import {sigmaStatusCardHtml} from ${JSON.stringify(source)}; console.log(sigmaStatusCardHtml({level:2,color:'#0e8f8f',sigmaText:'5.12',label:'Tốt',provisional:true,detailHtml:'details'}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy thẻ trạng thái Sigma TypeScript');
const html=result.stdout;
for(const fragment of ['background:#0e8f8f','Mức 2 — Sigma tạm tính','>5.12<','>Tốt<','>details<'])assert.ok(html.includes(fragment));
assert.ok(!sigmaStatusCardHtmlAbsentLabel(html));
console.log('Sigma status card HTML TypeScript tests passed');
function sigmaStatusCardHtmlAbsentLabel(html){return html.includes('undefined');}
