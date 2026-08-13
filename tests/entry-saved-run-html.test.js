const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-saved-run-html.ts')).href;
const program=`import { createEntrySavedRunHtml } from ${JSON.stringify(source)};const render=createEntrySavedRunHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({previousLot:true,previousLotNo:'L-01',valueClass:'warn',valueTitle:'Lô cũ',value:'5.2',z:'+2.1',label:'Cảnh báo'}),render({previousLot:false,previousLotNo:'',valueClass:'ok',valueTitle:'Đã lưu',value:'5',z:'-0.1',label:'Đạt'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [previous,current]=JSON.parse(output.stdout);
assert.match(previous,/prev-lot-slot/);
assert.match(previous,/E:\+2.1s · Lô E:L-01/);
assert.match(current,/qc-value-chip E:ok/);
assert.match(current,/E:-0.1s · E:Đạt/);
