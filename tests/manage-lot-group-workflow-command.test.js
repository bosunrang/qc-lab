const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createManageLotGroupWorkflowCommand} from './src/application/manage/manage-lot-group-workflow-command.ts';
let logs=[],saves=[],closed=0,renders=0;
const log=(...item)=>logs.push(item),saveState=value=>saves.push(value),close=()=>closed++,render=()=>renders++;
const group={
  save:input=>input.id?({ok:true,created:false,record:{name:'G1'}}):({ok:true,created:true,record:{name:'G1'}}),
  remove:()=>({ok:true,record:{name:'G1'}}),
  stop:()=>({ok:true,record:{name:'G1'}}),
};
const applied=createManageLotGroupWorkflowCommand({current:()=>({}),group,activation:{preview:()=>({ok:true,group:{name:'G1'},candidates:[],locked:{count:0,periods:[]}}),execute:()=>({ok:true,status:'applied',count:3,effects:{audit:[{action:'Kích hoạt nhóm lô',detail:'G1 · 3 dòng',target:'Nhóm lô'}],save:{}}})},reconcileSigma:()=>({pruned:2}),log,saveState,close,render});
const saved=applied.save({newId:'g1',data:{name:'G1'}});
const removed=applied.remove({id:'g1'});
const stopped=applied.stop({id:'g1',stoppedAt:'2026-08-18'});
const preview=applied.previewActivation({id:'g1'});
const executedApplied=applied.executeActivation({group:preview.group,candidates:preview.candidates,effectiveFrom:'2026-08-18',note:'Kích hoạt nhóm lô'});
const alreadyActive=createManageLotGroupWorkflowCommand({current:()=>({}),group,activation:{preview:()=>({ok:true,group:{name:'G1'},candidates:[],locked:{count:0,periods:[]}}),execute:()=>({ok:false,status:'already-active',group:{name:'G1'}})},reconcileSigma:()=>({pruned:0}),log,saveState,close,render});
const executedAlready=alreadyActive.executeActivation({group:{name:'G1'},candidates:[],effectiveFrom:'2026-08-18',note:'x'});
const unready=createManageLotGroupWorkflowCommand({current:()=>({}),group,activation:{preview:()=>({ok:true,group:{name:'G1'},candidates:[],locked:{count:0,periods:[]}}),execute:()=>({ok:false,status:'unready',group:{name:'G1'}})},reconcileSigma:()=>({pruned:0}),log,saveState,close,render});
const executedUnready=unready.executeActivation({group:{name:'G1'},candidates:[],effectiveFrom:'2026-08-18',note:'x'});
console.log(JSON.stringify({saved,removed,stopped,executedApplied,executedAlready,executedUnready,logs,saves,closed,renders}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.saved.ok,true);assert.equal(value.removed.ok,true);assert.equal(value.stopped.ok,true);
assert.equal(value.executedApplied.status,'applied');
assert.equal(value.executedAlready.status,'already-active');
assert.equal(value.executedUnready.status,'unready');
assert.deepEqual(value.logs,[
  ['Thêm nhóm lô','G1 · đã xóa 2 dữ liệu mức Sigma không còn trong nhóm','Nhóm lô'],
  ['Xóa nhóm lô','G1','Nhóm lô'],
  ['Dừng nhóm lô','G1','Nhóm lô'],
  ['Kích hoạt nhóm lô','G1 · 3 dòng','Nhóm lô'],
]);
assert.equal(value.closed,1);assert.equal(value.renders,5);assert.equal(value.saves.length,5);
console.log('Manage lot group workflow command TypeScript tests passed');
