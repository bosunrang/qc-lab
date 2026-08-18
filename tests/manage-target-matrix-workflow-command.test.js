const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createManageTargetMatrixWorkflowCommand} from './src/application/manage/manage-target-matrix-workflow-command.ts';let logs=[],saves=[],renders=0;const command=createManageTargetMatrixWorkflowCommand({current:()=>({qcPanels:[{id:'p1',name:'Panel 1'}]}),matrix:{execute:input=>({result:{count:2},auditDetail:'Panel 1 · G1 · 2 dòng'})},log:(...item)=>logs.push(item),saveState:value=>saves.push(value),render:()=>renders++});const committed=command.commit({picked:[],group:{name:'G1'},panelId:'p1',mode:'switch',overwrites:[],effectiveFrom:'2026-08-18'});console.log(JSON.stringify({committed,logs,saves,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.deepEqual(value.committed,{count:2});
assert.deepEqual(value.logs,[['Cập nhật Mean/SD','Panel 1 · G1 · 2 dòng','Mean/SD']]);
assert.equal(value.renders,1);assert.equal(value.saves.length,1);
console.log('Manage target matrix workflow command TypeScript tests passed');
