const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-point-row-html.ts')).href;
const program=`import { createEntryPointRowHtml } from ${JSON.stringify(source)};const render=createEntryPointRowHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({pointId:'P-1',rejected:true,warned:false,date:'01/08',value:'5.2',z:'+1.0',verdictClass:'rej',verdictLabel:'Loại',rulesHtml:'<rules>',voidButtonHtml:'<void>'}),render({pointId:'P-2',rejected:false,warned:true,date:'02/08',value:'5',z:'-2.1',verdictClass:'warn',verdictLabel:'Cảnh báo',rulesHtml:'—',voidButtonHtml:''})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [rejected,warned]=JSON.parse(output.stdout);
assert.match(rejected,/class="qc-point-rej"/);
assert.match(rejected,/data-qc-point-id="E:P-1"/);
assert.match(rejected,/E:\+1.0s/);
assert.match(rejected,/<rules>/);
assert.match(warned,/class="qc-point-warn"/);
assert.match(warned,/E:Cảnh báo/);
