const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createReagentComparisonWorkflowCommand} from './src/application/reagent/reagent-comparison-workflow-command.ts';
let logs=[],saves=[];
const command=createReagentComparisonWorkflowCommand({current:()=>({}),comparison:{create:(state,input)=>({comparison:{id:input.id,test:{name:input.name}}}),remove:(state,input)=>input.id==='missing'?({error:'not-found'}):({removed:{id:input.id,test:{name:'Old'}},nextId:'other'})},label:comparison=>comparison.test.name,log:(...item)=>logs.push(item),saveState:value=>saves.push(value)});
const created=command.create({id:'r1',name:'Glucose',unit:'mg/dL'});
const removed=command.remove({id:'r1'});
const missing=command.remove({id:'missing'});
console.log(JSON.stringify({created,removed,missing,logs,saves}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.created.comparison.id,'r1');
assert.equal(value.removed.nextId,'other');
assert.equal(value.missing.error,'not-found');
assert.deepEqual(value.logs,[['Tạo phép so sánh hóa chất','Glucose','Glucose'],['Xóa phép so sánh hóa chất','Old','Old']]);
assert.equal(value.saves.length,2);
console.log('Reagent comparison workflow command TypeScript tests passed');
