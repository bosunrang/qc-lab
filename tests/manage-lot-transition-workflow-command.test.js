const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createManageLotTransitionWorkflowCommand} from './src/application/manage/manage-lot-transition-workflow-command.ts';let logs=[],saves=[],renders=0;const command=createManageLotTransitionWorkflowCommand({current:()=>({}),transition:{checkRemoval:()=>({ok:true,record:{fromLotId:'f',toLotId:'t'}}),remove:()=>({ok:true,effects:{audit:[{action:'Xóa chuyển tiếp lô',detail:'f → t',target:'Chuyển tiếp lô'}],save:{}}})},log:(...item)=>logs.push(item),saveState:value=>saves.push(value),render:()=>renders++});const checked=command.checkRemoval({id:'t1'}),removed=command.remove({id:'t1'});console.log(JSON.stringify({checked,removed,logs,saves,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.checked.ok,true);assert.equal(value.removed.ok,true);
assert.deepEqual(value.logs,[['Xóa chuyển tiếp lô','f → t','Chuyển tiếp lô']]);
assert.equal(value.renders,1);assert.equal(value.saves.length,1);
console.log('Manage lot transition workflow command TypeScript tests passed');
