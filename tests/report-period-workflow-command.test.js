const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createReportPeriodWorkflowCommand} from './src/application/period/report-period-workflow-command.ts';let state={periodLocks:[]},logs=[],saves=[],renders=0;const period={lock:input=>{input.state.periodLocks.push(input.ym);return {ok:true,effects:{audit:{action:'Khóa',detail:input.label,target:'Kỳ'},save:{clearDerived:false}}};},unlock:input=>{input.state.periodLocks=[];return {ok:true,effects:{audit:{action:'Mở',detail:input.label,target:'Kỳ'},save:{clearDerived:false}}};}};const command=createReportPeriodWorkflowCommand({current:()=>state,period,log:(...item)=>logs.push(item),save:options=>saves.push(options),render:()=>renders++});const locked=command.lock({ym:'2026-08',lockedAt:'now',lockedBy:'Admin',id:'p1',label:'Tháng 8'});const unlocked=command.unlock({ym:'2026-08',reason:'Sửa sai',label:'Tháng 8'});console.log(JSON.stringify({locked,unlocked,state,logs,saves,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.locked.ok,true);assert.equal(value.unlocked.ok,true);assert.deepEqual(value.state,{periodLocks:[]});assert.deepEqual(value.logs.map(item=>item[0]),['Khóa','Mở']);assert.deepEqual(value.saves,[{clearDerived:false},{clearDerived:false}]);assert.equal(value.renders,2);
console.log('Report period workflow command TypeScript tests passed');
