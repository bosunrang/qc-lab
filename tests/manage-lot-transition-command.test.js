'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','manage','manage-lot-transition-command.ts')).href;
const program=`import {createManageLotTransitionCommand} from ${JSON.stringify(source)};
const state={qcLots:[{id:'f',lotNo:'L01'},{id:'t',lotNo:'L02'}],lotTransitions:[]};
const command=createManageLotTransitionCommand({
  validate:(s,i)=>i.panelId==='pn'?{old:null,fromLot:s.qcLots[0],toLot:s.qcLots[1],finalChanged:i.status==='accepted'}:{error:'missing-panel',message:'Chọn Panel QC.'},
  prepareData:i=>({panelId:i.panelId,fromLotId:i.fromLotId,toLotId:i.toLotId,status:i.status,startDate:i.startDate||i.today,approvedBy:i.finalChanged?i.approvedBy:'',approvedAt:i.finalChanged?i.approvedAt:''}),
  inspect:(s,tr)=>tr.failEmpty?{rows:[],missing:[],valid:true}:(tr.failMissing?{rows:[{test:{id:'x'}}],missing:[{test:{name:'Glucose'}}],valid:true}:{rows:[{test:{id:'x'}}],missing:[],valid:true}),
  save:(s,i)=>{const record={id:i.id||i.newId,...i.data};s.lotTransitions.push(record);return{record,created:!i.id};},
  applyAccepted:tr=>tr.status==='accepted'?3:0,
  syncDepletion:s=>{const retired=new Set(s.lotTransitions.filter(x=>x.status==='accepted').map(x=>x.fromLotId));s.qcLots.forEach(l=>{l.depleted=retired.has(l.id);});},
  removal:(s,i)=>{const record=s.lotTransitions.find(x=>x.id===i.id);if(!record)return{error:'not-found'};if(record.status==='accepted')return{error:'accepted-applied',record,message:'đã chấp nhận'};return{record};},
  removeRecord:(s,i)=>{s.lotTransitions=s.lotTransitions.filter(x=>x.id!==i.id);return{record:{id:i.id,fromLotId:'f',toLotId:'t'}};},
  findLot:(s,id)=>(s.qcLots||[]).find(l=>l.id===id),
  lotLabel:id=>id==='f'?'L01':'L02',panelName:()=>'Panel Hóa sinh',statusText:st=>st==='accepted'?'Chấp nhận lô mới':st,
  testName:test=>test.name,
});
const bad=command.prepare({state,panelId:'',fromLotId:'f',toLotId:'t',status:'planned',startDate:'',today:'2026-08-16',approvedBy:'',approvedAt:''});
const planned=command.prepare({state,id:'',panelId:'pn',fromLotId:'f',toLotId:'t',status:'planned',startDate:'',today:'2026-08-16',approvedBy:'',approvedAt:''});
const accepted=command.prepare({state,id:'',panelId:'pn',fromLotId:'f',toLotId:'t',status:'accepted',startDate:'2026-08-01',today:'2026-08-16',approvedBy:'Admin',approvedAt:'2026-08-16T00:00:00Z'});
const gateSkip=command.acceptanceGate({state,data:{status:'planned'},finalChanged:false});
const gateEmpty=command.acceptanceGate({state,data:{status:'accepted',failEmpty:true},finalChanged:true});
const gateMissing=command.acceptanceGate({state,data:{status:'accepted',failMissing:true,toLotId:'t'},finalChanged:true});
const gateOk=command.acceptanceGate({state,data:{status:'accepted',toLotId:'t'},finalChanged:true});
const saved=command.execute({state,id:'',newId:'tr1',data:accepted.data});
const removalBlocked=(state.lotTransitions.push({id:'tr2',fromLotId:'f',toLotId:'t',status:'accepted'}),command.remove({state,id:'tr2'}));
state.lotTransitions[0].status='planned';
const removed=command.remove({state,id:'tr1'});
console.log(JSON.stringify({bad,planned:{ok:planned.ok,needsReauth:planned.needsReauth,startDate:planned.data.startDate},accepted:{ok:accepted.ok,needsReauth:accepted.needsReauth,approvedBy:accepted.data.approvedBy},gateSkip,gateEmpty,gateMissing:{ok:gateMissing.ok,message:gateMissing.message},gateOk,saved:{ok:saved.ok,switched:saved.switched,created:saved.created,audit:saved.effects.audit,depleted:state.qcLots[0].depleted},removalBlocked:{ok:removalBlocked.ok,error:removalBlocked.error},removed:{ok:removed.ok,audit:removed.effects.audit,left:state.lotTransitions.length}}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy lot-transition command TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output.bad.ok,false);assert.equal(output.bad.error,'missing-panel');
assert.equal(output.planned.ok,true);assert.equal(output.planned.needsReauth,false,'chuyển trạng thái thường không cần re-auth');
assert.equal(output.planned.startDate,'2026-08-16','ngày bắt đầu trống phải nhận hôm nay');
assert.equal(output.accepted.needsReauth,true,'kết luận chấp nhận/từ chối lô mới phải re-auth');
assert.equal(output.accepted.approvedBy,'Admin');
assert.equal(output.gateSkip.ok,true,'gate bỏ qua khi không phải chấp nhận lần đầu');
assert.equal(output.gateEmpty.ok,false,'panel không có xét nghiệm dùng lô cũ thì chặn');
assert.equal(output.gateMissing.ok,false);assert.match(output.gateMissing.message,/Glucose.*L02/,'gate phải nêu xét nghiệm thiếu Mean/SD và lô mới');
assert.equal(output.gateOk.ok,true);
assert.equal(output.saved.ok,true);assert.equal(output.saved.switched,3);assert.equal(output.saved.created,true);
assert.equal(output.saved.depleted,true,'lô cũ phải bị khóa sau khi chấp nhận');
const actions=output.saved.audit.map(a=>a.action);
assert.deepEqual(actions,['Khóa lô đã hết','Áp dụng chuyển tiếp lô','Thêm chuyển lô QC']);
assert.equal(output.removalBlocked.ok,false);assert.equal(output.removalBlocked.error,'accepted-applied','hồ sơ đã chấp nhận không được xóa');
assert.equal(output.removed.ok,true);assert.equal(output.removed.left,1);
assert.equal(output.removed.audit[0].action,'Xóa chuyển tiếp lô');assert.equal(output.removed.audit[0].detail,'L01 → L02');
console.log('Lot-transition command TypeScript tests passed');
