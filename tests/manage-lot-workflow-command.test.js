const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createManageLotWorkflowCommand} from './src/application/manage/manage-lot-workflow-command.ts';let logs=[],saves=[],closed=0,renders=0;const command=createManageLotWorkflowCommand({current:()=>({}),lot:{preview:()=>({ok:true,rename:null}),execute:input=>({ok:true,effects:{audit:[{action:'Thêm lô QC',detail:input.data.lotNo,target:'Lô QC'}],save:{}}}),checkRemoval:()=>({ok:true,record:{lotNo:'L1'}}),remove:()=>({ok:true,effects:{audit:[{action:'Xóa lô QC',detail:'L1',target:'Lô QC'}],save:{}}})},log:(...item)=>logs.push(item),saveState:value=>saves.push(value),close:()=>closed++,render:()=>renders++});const preview=command.preview({data:{lotNo:'L1'}}),executed=command.execute({newId:'l1',data:{lotNo:'L1'}}),checked=command.checkRemoval({id:'l1'}),removed=command.remove({id:'l1'});console.log(JSON.stringify({preview,executed,checked,removed,logs,saves,closed,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.preview.ok,true);assert.equal(value.executed.ok,true);assert.equal(value.checked.ok,true);assert.equal(value.removed.ok,true);
assert.deepEqual(value.logs.map(item=>item[0]),['Thêm lô QC','Xóa lô QC']);
assert.equal(value.closed,1);assert.equal(value.renders,2);assert.equal(value.saves.length,2);
console.log('Manage lot workflow command TypeScript tests passed');
