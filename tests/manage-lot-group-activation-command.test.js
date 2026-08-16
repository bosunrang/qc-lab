'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','manage','manage-lot-group-activation-command.ts')).href;
const program=`import {createManageLotGroupActivationCommand} from ${JSON.stringify(source)};
const state={lotGroups:[{id:'g1',name:'L01/L02',lotIds:['l1','l2']},{id:'g2',active:false,lotIds:['l3']}],qcLots:[{id:'l1'},{id:'l2'},{id:'l3'}]};
const command=createManageLotGroupActivationCommand({
  findGroup:(s,id)=>(s.lotGroups||[]).find(g=>g.id===id)||null,
  lotsOfGroup:(s,g)=>(g.lotIds||[]).map(lotId=>(s.qcLots||[]).find(l=>l.id===lotId)).filter(Boolean),
  candidatesFor:()=>[{t:{id:'t1'},lot:{id:'l1'},pick:{use:true}}],
  backfillPoints:()=>[{id:'p1'},{id:'p2'}],
  lockedPoints:()=>({count:1,periods:['2026-07']}),
  applyActivation:input=>input.candidates.length?{status:'applied',count:input.candidates.length}:{status:'unready',count:0},
});
const missing=command.preview({state,id:'nope'});
const stopped=command.preview({state,id:'g2'});
const preview=command.preview({state,id:'g1'});
const applied=command.execute({state,group:preview.group,candidates:preview.candidates,effectiveFrom:'2026-08-16',note:'Kích hoạt nhóm lô'});
const unready=command.execute({state,group:preview.group,candidates:[],effectiveFrom:'2026-08-16',note:'Kích hoạt nhóm lô'});
console.log(JSON.stringify({missing,stopped,preview:{ok:preview.ok,locked:preview.locked,candidates:preview.candidates.length},applied,unready}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy lot-group activation command TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output.missing.ok,false);assert.equal(output.missing.reason,'not-found');
assert.equal(output.stopped.ok,false,'nhóm đã dừng (active===false) không được kích hoạt qua đường này');
assert.equal(output.preview.ok,true);assert.deepEqual(output.preview.locked,{count:1,periods:['2026-07']},'preview phải giữ guard kỳ đã khóa cho hộp xác nhận');
assert.equal(output.preview.candidates,1);
assert.equal(output.applied.ok,true);assert.equal(output.applied.status,'applied');assert.equal(output.applied.count,1);
assert.deepEqual(output.applied.effects.audit,[{action:'Kích hoạt nhóm lô',detail:'L01/L02 · 1 dòng',target:'Nhóm lô'}]);
assert.deepEqual(output.applied.effects.save,{});
assert.equal(output.unready.ok,false);assert.equal(output.unready.status,'unready');
console.log('Lot-group activation command TypeScript tests passed');
