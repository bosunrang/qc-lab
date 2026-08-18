const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createActivityArchiveCommand} from './src/application/audit/activity-archive-command.ts';
let state={activity:[{id:'old',ts:'2024-01-01',hash:'tip'},{id:'new',ts:'2026-01-01',hash:'new'}],activityAnchor:''},downloads=[],logs=[],saved=0,closed=0,rendered=0,infos=[];const command=createActivityArchiveCommand({current:()=>state,window:()=>({months:24,cutoffIso:'2025-01-01T00:00:00.000Z'}),cut:items=>({segment:items.slice(0,1),retained:items.slice(1),tipHash:'tip'}),confirm:async()=>true,reauthenticate:async()=>true,download:(name,rows)=>downloads.push([name,rows.length]),log:(...item)=>logs.push(item),save:()=>saved++,close:()=>closed++,render:()=>rendered++,info:async(...item)=>infos.push(item),dateLabel:value=>'DATE:'+value});const done=await command.execute('24');const empty=await createActivityArchiveCommand({...{current:()=>({activity:[],activityAnchor:''}),window:()=>({months:24,cutoffIso:'2025-01-01T00:00:00.000Z'}),cut:()=>({segment:[],retained:[],tipHash:''}),confirm:async()=>true,reauthenticate:async()=>true,download:()=>{},log:()=>{},save:()=>{},close:()=>closed++,render:()=>{},info:async(...item)=>infos.push(item),dateLabel:value=>value}}).execute('24');console.log(JSON.stringify({done,empty,state,downloads,logs,saved,closed,rendered,infos}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.deepEqual(value.done,{status:'done'});assert.deepEqual(value.empty,{status:'empty'});
assert.equal(value.state.activity.length,1);assert.equal(value.state.activityAnchor,'tip');
assert.deepEqual(value.downloads,[['Luu_tru_nhat_ky_QCLab_2025-01-01.csv',1]]);assert.equal(value.logs[0][0],'Lưu trữ nhật ký hoạt động');assert.match(value.logs[0][1],/Hash đỉnh phần lưu trữ: tip/);
assert.equal(value.saved,1);assert.equal(value.rendered,1);assert.equal(value.closed,2);
console.log('Activity archive command TypeScript tests passed');
