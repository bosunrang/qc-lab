'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','period','report-period-command.ts')).href;
const program=`import {createReportPeriodCommand} from ${JSON.stringify(source)};
const state={periodLocks:[]};
const command=createReportPeriodCommand({
 lock:(s,i)=>{if(s.periodLocks.some(x=>x.ym===i.ym))return{error:'already-locked'};const lock={ym:i.ym,lockedAt:i.lockedAt,lockedBy:i.lockedBy,id:i.id};s.periodLocks.push(lock);return{lock};},
 unlock:(s,i)=>{if(String(i.reason).length<5)return{error:'reason-too-short'};const index=s.periodLocks.findIndex(x=>x.ym===i.ym);if(index<0)return{error:'not-locked'};return{lock:s.periodLocks.splice(index,1)[0],reason:i.reason.trim()};},
});
const locked=command.lock({state,ym:'2026-08',lockedAt:'2026-08-16T00:00:00.000Z',lockedBy:'Admin',id:'lock-1',label:'Tháng 08/2026'});
const duplicate=command.lock({state,ym:'2026-08',lockedAt:'',lockedBy:'',id:'',label:'Tháng 08/2026'});
const short=command.unlock({state,ym:'2026-08',reason:'abc',label:'Tháng 08/2026'});
const unlocked=command.unlock({state,ym:'2026-08',reason:'  Đã rà soát  ',label:'Tháng 08/2026'});
const missing=command.unlock({state,ym:'2026-08',reason:'Đã rà soát',label:'Tháng 08/2026'});
console.log(JSON.stringify({locked,duplicate,short,unlocked,missing,left:state.periodLocks.length}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy report-period command TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output.locked.ok,true);assert.deepEqual(output.locked.effects,{audit:{action:'Khóa kỳ báo cáo',detail:'Tháng 08/2026',target:'Kỳ báo cáo'},save:{clearDerived:false}});
assert.deepEqual(output.duplicate,{ok:false,error:'already-locked'});
assert.deepEqual(output.short,{ok:false,error:'reason-too-short'});
assert.equal(output.unlocked.ok,true);assert.deepEqual(output.unlocked.effects,{audit:{action:'Mở khóa kỳ báo cáo',detail:'Tháng 08/2026 · Lý do: Đã rà soát',target:'Kỳ báo cáo'},save:{clearDerived:false}});
assert.deepEqual(output.missing,{ok:false,error:'not-locked'});assert.equal(output.left,0);
console.log('Report period command TypeScript tests passed');
