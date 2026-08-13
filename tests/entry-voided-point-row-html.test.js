const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-voided-point-row-html.ts')).href;
const program=`import { createEntryVoidedPointRowHtml } from ${JSON.stringify(source)};const render=createEntryVoidedPointRowHtml({escape:value=>'E:'+value});console.log(render({pointId:'P-1',date:'01/08',levelLot:'Mức 1 · Lô L-01',value:'5.2',runId:'R1',voidedBy:'Admin',reason:'Sai số nhập'}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/data-qc-point-id="E:P-1"/);
assert.match(output.stdout,/E:Mức 1 · Lô L-01/);
assert.match(output.stdout,/E:Sai số nhập/);
