const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-day-status-html.ts')).href;
const program=`import { entryDayStatusHtml } from ${JSON.stringify(source)};console.log(JSON.stringify([entryDayStatusHtml({hasPoint:false,level:'ok'}),entryDayStatusHtml({hasPoint:true,level:'rej'}),entryDayStatusHtml({hasPoint:true,level:'warn'}),entryDayStatusHtml({hasPoint:true,level:'ok'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.deepEqual(JSON.parse(output.stdout),['—','<span class="tag rej">R</span>','<span class="tag warn">W(A)</span>','<span class="tag ok">A</span>']);
