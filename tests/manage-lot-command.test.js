'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','manage','manage-lot-command.ts')).href;
const program=`import {createManageLotCommand} from ${JSON.stringify(source)};
const state={qcLots:[{id:'L1',lotNo:'OLD123',level:1},{id:'L2',lotNo:'L2X',level:2}],data:{T1:[{id:'p1',level:1,lot:'OLD123'},{id:'p2',level:1,lot:'OLD123'}]}};
const command=createManageLotCommand({
  validate:(s,i)=>{if(!i.data.lotNo)return{error:'missing-lot-no',message:'Nhập số lot.'};return{record:(s.qcLots||[]).find(l=>l.id===i.id)||null};},
  pointsToRename:(s,level,lotNo)=>Object.keys(s.data||{}).flatMap(tid=>(s.data[tid]||[]).filter(p=>+p.level===+level&&p.lot===lotNo)),
  lockedPoints:()=>({count:1,periods:['2026-07']}),
  save:(s,i)=>{const old=(s.qcLots||[]).find(l=>l.id===i.id);const record=old||{id:i.newId};const oldNo=old?old.lotNo:'';Object.assign(record,i.data);if(!old)s.qcLots.push(record);let renamed=0;if(old&&oldNo&&oldNo!==i.data.lotNo)renamed=i.renamePoints?0:0;renamed=old&&oldNo!==i.data.lotNo?2:0;return{record,created:!old,renamedPoints:renamed};},
  removal:(s,i)=>{const record=(s.qcLots||[]).find(l=>l.id===i.id);return record?{record}:{error:'not-found'};},
  removeRecord:(s,i)=>{const record=(s.qcLots||[]).find(l=>l.id===i.id);if(!record)return{error:'not-found'};s.qcLots=s.qcLots.filter(l=>l.id!==i.id);return{record};},
});
const invalid=command.preview({state,id:'',data:{lotNo:'',level:1}});
const created=command.preview({state,id:'',data:{lotNo:'L3',level:1}});
const rename=command.preview({state,id:'L1',data:{lotNo:'NEW456',level:1}});
const quiet=command.preview({state,id:'L1',data:{lotNo:'OLD123',level:1,note:'x'}});
const executed=command.execute({state,id:'L1',newId:'',data:{lotNo:'NEW456',level:1}});
const added=command.execute({state,id:'',newId:'L3',data:{lotNo:'L3',level:2}});
const missing=command.remove({state,id:'NOPE'});
const removed=command.remove({state,id:'L2'});
console.log(JSON.stringify({invalid:{ok:invalid.ok,error:invalid.error},created:{ok:created.ok,rename:created.rename},rename:{ok:rename.ok,rename:rename.rename},quiet:{ok:quiet.ok,rename:quiet.rename},executed:{ok:executed.ok,created:executed.created,renamed:executed.renamedPoints,audit:executed.effects.audit},added:{ok:added.ok,created:added.created,audit:added.effects.audit},missing:{ok:missing.ok,error:missing.error},removed:{ok:removed.ok,audit:removed.effects.audit,left:state.qcLots.length}}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy lot command TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output.invalid.ok,false);assert.equal(output.invalid.error,'missing-lot-no');
assert.equal(output.created.ok,true);assert.equal(output.created.rename,null,'lô mới không có kế hoạch đổi tên');
assert.equal(output.rename.ok,true);
assert.deepEqual(output.rename.rename,{oldLotNo:'OLD123',newLotNo:'NEW456',affected:2,locked:{count:1,periods:['2026-07']}},'preview phải đếm điểm bị viết lại và giữ guard kỳ đã khóa');
assert.equal(output.quiet.rename,null,'không đổi số lô thì không hỏi thừa');
assert.equal(output.executed.ok,true);assert.equal(output.executed.created,false);assert.equal(output.executed.renamed,2);
assert.match(output.executed.audit[0].detail,/NEW456 · Mức 1 · Đã cập nhật 2 điểm QC cũ theo số lô mới/);
assert.equal(output.executed.audit[0].action,'Cập nhật lô QC');
assert.equal(output.added.created,true);assert.equal(output.added.audit[0].action,'Thêm lô QC');
assert.equal(output.missing.ok,false);assert.equal(output.missing.error,'not-found');
assert.equal(output.removed.ok,true);assert.deepEqual(output.removed.audit,[{action:'Xóa lô QC',detail:'L2X',target:'Lô QC'}]);
assert.equal(output.removed.left,2);
console.log('Lot command TypeScript tests passed');
