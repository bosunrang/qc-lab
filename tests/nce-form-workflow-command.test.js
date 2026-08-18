const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createNceFormWorkflowCommand} from './src/application/nce/nce-form-workflow-command.ts';let state={},logs=[],resets=0,saves=0,renders=0;const command=createNceFormWorkflowCommand({current:()=>state,form:{submit:input=>input.values.ok?{ok:true,mode:'create',record:{id:'n1'}}:{ok:false,message:'Thiếu'}},log:(...item)=>logs.push(item),reset:()=>resets++,save:()=>saves++,render:()=>renders++});const invalid=command.submit({values:{ok:false},audit:()=>({action:'Sai',detail:'',target:''})});const done=command.submit({values:{ok:true},audit:result=>({action:'Tạo',detail:result.record.id,target:'NCE'})});console.log(JSON.stringify({invalid,done,state,logs,resets,saves,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.deepEqual(value.invalid,{ok:false,message:'Thiếu'});assert.equal(value.done.ok,true);assert.deepEqual(value.state,{actions:[]});assert.deepEqual(value.logs,[['Tạo','n1','NCE']]);assert.deepEqual([value.resets,value.saves,value.renders],[1,1,1]);
console.log('NCE form workflow command TypeScript tests passed');
