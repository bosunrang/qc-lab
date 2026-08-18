const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createEntryDateNoteWorkflowCommand} from './src/application/entry/entry-date-note-workflow-command.ts';
let logs=[],saves=[];
const command=createEntryDateNoteWorkflowCommand({current:()=>({}),entry:{updateDateNoteCommand:(state,input)=>({ok:true,note:input.value,effects:{audit:{action:'Cập nhật ghi chú ngày',detail:input.value,target:input.testId},save:{testId:input.testId}}})},formatDate:date=>'vn:'+date,log:(...item)=>logs.push(item),saveState:value=>saves.push(value)});
const saved=command.save({testId:'t1',date:'2026-08-19',value:'ghi chu moi'});
console.log(JSON.stringify({saved,logs,saves}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.saved.ok,true);assert.equal(value.saved.note,'ghi chu moi');
assert.deepEqual(value.logs,[['Cập nhật ghi chú ngày','ghi chu moi','t1']]);
assert.deepEqual(value.saves,[{testId:'t1'}]);
console.log('Entry date note workflow command TypeScript tests passed');
