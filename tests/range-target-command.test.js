const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createRangeTargetCommand} from './src/application/range/range-target-command.ts';
let assigned=[];
const command=createRangeTargetCommand({assignTarget:(config,mean,sd,source)=>{if(!Number.isFinite(mean)||!Number.isFinite(sd))return false;assigned.push([mean,sd,source]);config.mean=mean;config.sd=sd;config.low=mean-2*sd;config.high=mean+2*sd;return true;}});
const state={actions:[]};
const level={mean:10,sd:1,low:8,high:12,lot:'L1',qcLotId:'q1',exp:'2026-12-31'};
const applied=command.applyLab({state,level,testId:'t1',levelNo:1,lot:'L1',testName:'Glucose',mean:11,sd:1.2,cv:5,reason:'ly do du dai',gateNote:'',detail:'detail text',actionText:'action text',historyId:'h1',actionId:'a1',today:'2026-08-19',createdAt:'2026-08-19T00:00:00.000Z',userId:'u1',username:'kt1',userName:'Ky thuat vien'});
const failed=command.applyLab({state,level:{},testId:'t1',levelNo:1,lot:'',testName:'',mean:NaN,sd:NaN,cv:0,reason:'',gateNote:'',detail:'',actionText:'',historyId:'h2',actionId:'a2',today:'2026-08-19',createdAt:'x',userId:'',username:'',userName:''});
const level2={mean:11,sd:1.2,low:8,high:14,mfgMean:10,mfgSd:1,lot:'L1',qcLotId:'q1',exp:'2026-12-31'};
const reverted=command.revertMfg({state,level:level2,testId:'t1',levelNo:1,lot:'L1',testName:'Glucose',reason:'ly do',detail:'detail revert',actionText:'action revert',historyId:'h3',actionId:'a3',today:'2026-08-19',createdAt:'2026-08-19T00:00:00.000Z',userId:'u1',username:'kt1',userName:'Ky thuat vien'});
console.log(JSON.stringify({applied,failed,reverted,state,level,level2,assigned}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);

assert.equal(value.applied.ok,true);
assert.deepEqual(value.applied.effects.audit,{action:'Áp dụng dải QC',detail:'detail text',target:'Glucose'});
assert.deepEqual(value.applied.effects.save,{testId:'t1'});
assert.equal(value.failed.ok,false);
assert.equal(value.failed.message,'Không áp dụng được dải mới.');
assert.equal(value.reverted.ok,true);
assert.deepEqual(value.reverted.effects.audit,{action:'Hoàn dải QC',detail:'detail revert',target:'Glucose'});

assert.equal(value.level.cvRef,5);assert.equal(value.level.rangeDate,'2026-08-19');
assert.equal(value.level.meanSdHistory.length,1);
assert.deepEqual(value.level.meanSdHistory[0],{id:'h1',qcLotId:'q1',lot:'L1',mean:11,sd:1.2,low:value.level.low,high:value.level.high,effectiveFrom:'2026-08-19',effectiveTo:'2026-12-31',source:'lab',note:'ly do du dai'});

assert.equal(value.level2.meanSdHistory.length,1);
assert.deepEqual(value.level2.meanSdHistory[0],{id:'h3',qcLotId:'q1',lot:'L1',mean:10,sd:1,low:value.level2.low,high:value.level2.high,effectiveFrom:'2026-08-19',effectiveTo:'2026-12-31',source:'mfg',note:'ly do'});

assert.equal(value.state.actions.length,2);
assert.equal(value.state.actions[0].id,'a1');assert.equal(value.state.actions[0].rule,'Thiết lập dải QC mới');assert.equal(value.state.actions[0].action,'action text');assert.equal(value.state.actions[0].approvalStatus,'pending');
assert.equal(value.state.actions[1].id,'a3');assert.equal(value.state.actions[1].rule,'Hoàn dải QC');assert.equal(value.state.actions[1].action,'action revert');

console.log('Range target command TypeScript tests passed');
