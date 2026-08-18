const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createManageAssayWorkflowCommand} from './src/application/manage/manage-assay-workflow-command.ts';let logs=[],saves=[],closed=0,renders=0;const command=createManageAssayWorkflowCommand({current:()=>({}),assay:{execute:input=>({ok:true,effects:{audit:{action:'Thêm xét nghiệm',detail:input.data.name,target:input.data.name},save:{}}})},removal:{execute:()=>({ok:true,effects:{audit:{action:'Xóa test/lô',detail:'Xóa xét nghiệm và 3 điểm QC',target:'Glucose'},save:{}}})},log:(...item)=>logs.push(item),saveState:value=>saves.push(value),close:()=>closed++,render:()=>renders++});const saved=command.save({newId:'a1',data:{name:'Glucose'}});const removed=command.remove({id:'a1'});console.log(JSON.stringify({saved,removed,logs,saves,closed,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.saved.ok,true);assert.equal(value.removed.ok,true);
assert.deepEqual(value.logs,[['Thêm xét nghiệm','Glucose','Glucose'],['Xóa test/lô','Xóa xét nghiệm và 3 điểm QC','Glucose']]);
assert.equal(value.closed,1);assert.equal(value.renders,2);assert.equal(value.saves.length,2);
console.log('Manage assay workflow command TypeScript tests passed');
