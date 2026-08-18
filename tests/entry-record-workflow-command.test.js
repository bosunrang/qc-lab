const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createEntryRecordWorkflowCommand} from './src/application/entry/entry-record-workflow-command.ts';let state={id:'state'},logs=[],saves=[];const command=createEntryRecordWorkflowCommand({current:()=>state,record:{execute:input=>input.testId==='t1'?{ok:true,point:{id:'p1'},effects:{save:{testId:'t1'}}}:{ok:false,error:'not-ready'}},log:(...item)=>logs.push(item),save:options=>saves.push(options)});const done=command.execute({testId:'t1',audit:result=>({action:'Thêm',detail:result.point.id,target:'QC'})});const failed=command.execute({testId:'x',audit:()=>({action:'Sai',detail:'',target:''})});console.log(JSON.stringify({done,failed,logs,saves}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.done.ok,true);assert.deepEqual(value.failed,{ok:false,error:'not-ready'});assert.deepEqual(value.logs,[['Thêm','p1','QC']]);assert.deepEqual(value.saves,[{testId:'t1'}]);
console.log('Entry record workflow command TypeScript tests passed');
