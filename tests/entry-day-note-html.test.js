const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','entry','entry-day-note-html.ts')).href;
const program=`import { createEntryDayNoteHtml } from ${JSON.stringify(source)};const render=createEntryDayNoteHtml({escape:value=>'E:'+value});console.log(JSON.stringify([render({hasPoint:false,canWrite:true,testId:'T1',date:'2026-08-13',automaticNote:'',manualNote:''}),render({hasPoint:true,canWrite:false,testId:'T1',date:'',automaticNote:'Cảnh báo',manualNote:''}),render({hasPoint:true,canWrite:true,testId:'T1',date:'2026-08-13',automaticNote:'Cảnh báo',manualNote:'Ghi chú'})]));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const [empty,readonly,editable]=JSON.parse(output.stdout);
assert.equal(empty,'—');
assert.equal(readonly,'E:Cảnh báo');
assert.match(editable,/placeholder="E:Cảnh báo"/);
assert.match(editable,/entryDateNoteSave\('E:T1','E:2026-08-13',this.value\)/);
assert.match(editable,/E:Ghi chú/);
