const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createNceLifecycleWorkflowCommand} from './src/application/nce/nce-lifecycle-workflow-command.ts';let state={actions:[{id:'n1'}]},logs=[],saves=0,renders=0;const command=createNceLifecycleWorkflowCommand({current:()=>state,lifecycle:{execute:input=>input.id==='n1'?{ok:true,record:input.actions[0]}:{ok:false,reason:'missing'}},log:(...item)=>logs.push(item),save:()=>saves++,render:()=>renders++});const done=command.execute({kind:'approve',id:'n1',audit:record=>({action:'Duyệt',detail:record.id,target:'NCE'})});const failed=command.execute({kind:'approve',id:'none',audit:()=>({action:'Sai',detail:'',target:''})});console.log(JSON.stringify({done,failed,logs,saves,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.done.ok,true);assert.deepEqual(value.failed,{ok:false,reason:'missing'});assert.deepEqual(value.logs,[['Duyệt','n1','NCE']]);assert.equal(value.saves,1);assert.equal(value.renders,1);
console.log('NCE lifecycle workflow command TypeScript tests passed');
