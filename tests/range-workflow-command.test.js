const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createRangeWorkflowCommand} from './src/application/range/range-workflow-command.ts';
let logs=[],saves=[],renders=0;
const command=createRangeWorkflowCommand({current:()=>({}),target:{applyLab:()=>({ok:true,effects:{audit:{action:'Áp dụng dải QC',detail:'d1',target:'Glucose'},save:{testId:'t1'}}}),revertMfg:()=>({ok:false,message:'Không tìm thấy Mean/SD nhà sản xuất hợp lệ để hoàn về.'})},log:(...item)=>logs.push(item),saveState:value=>saves.push(value),render:()=>renders++});
const applied=command.applyLab({});
const reverted=command.revertMfg({});
console.log(JSON.stringify({applied,reverted,logs,saves,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.applied.ok,true);
assert.equal(value.reverted.ok,false);
assert.deepEqual(value.logs,[['Áp dụng dải QC','d1','Glucose']]);
assert.equal(value.renders,1);assert.equal(value.saves.length,1);
console.log('Range workflow command TypeScript tests passed');
