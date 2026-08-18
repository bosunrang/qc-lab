const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createManageInstrumentWorkflowCommand} from './src/application/manage/manage-instrument-workflow-command.ts';let state={},logs=[],saves=[],closed=0,renders=0;const command=createManageInstrumentWorkflowCommand({current:()=>state,instrument:{save:input=>({ok:true,effects:{audit:{action:'Thêm',detail:input.data.name,target:'Máy'},save:{clearDerived:false}}}),remove:()=>({ok:true,effects:{audit:{action:'Xóa',detail:'Máy A',target:'Máy'},save:{clearDerived:false}}})},log:(...item)=>logs.push(item),saveState:options=>saves.push(options),close:()=>closed++,render:()=>renders++});const saved=command.save({newId:'i1',data:{name:'Máy A'}}),removed=command.remove({id:'i1'});console.log(JSON.stringify({saved,removed,logs,saves,closed,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);assert.equal(value.saved.ok,true);assert.equal(value.removed.ok,true);assert.deepEqual(value.logs.map(item=>item[0]),['Thêm','Xóa']);assert.equal(value.closed,1);assert.equal(value.renders,2);
console.log('Manage instrument workflow command TypeScript tests passed');
