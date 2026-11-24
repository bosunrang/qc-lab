// Ca quan sát khi kiểm tra lại bản df85925 ngày 10/11/2026.
// Chỉ dùng CSDL trong bộ nhớ; in kết quả thực tế, không coi đó là hành vi đúng.
// Sau npm run build: node docs/app-review-recheck-probes-2026-11-10.cjs
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = process.argv[2] || path.resolve(__dirname, '..');
const load = p => require(path.join(root,'app-dist/main',p));
const { openDatabase } = load('db/open-database.js');
const { createConfigHandlers } = load('ipc/config-handlers.js');
const { createEntryHandlers } = load('ipc/entry-handlers.js');
const { createReportHandlers } = load('ipc/report-handlers.js');
const { createNceHandlers } = load('ipc/nce-handlers.js');
const { nceQueueRows } = load('db/nce-evaluation.js');
const admin={userId:'recheck-admin',username:'review',name:'Người kiểm tra lại',role:'admin',clientId:'recheck'};
const must=r=>{if(!r?.ok)throw new Error(JSON.stringify(r));return r.data;};
(async()=>{
 const {makeOperationalQc}=await import(pathToFileURL(path.join(root,'app/tests/helpers/operational-fixture.mjs')));
 const {ensureUser,createIqcNce}=await import(pathToFileURL(path.join(root,'app/tests/helpers/nce-flow.mjs')));
 function fixture(){
  const db=openDatabase(':memory:');ensureUser(db,admin);const config=createConfigHandlers(db);
  const instrument=must(config.saveInstrument({data:{name:'Máy kiểm tra'}},admin));
  const assay=must(config.saveTest({data:{name:'Glucose',instrumentId:instrument.id}},admin));const lots=[];
  for(const [level,mean,sd]of [[1,100,2],[2,200,4]]){
   const lot=must(config.saveLot({data:{lotNo:'L'+level,level}},admin));lots.push(lot);
   must(config.saveTestLevel({testId:assay.id,data:{level,mean,sd,qcLotId:lot.id}},admin));
  }
  const operation=makeOperationalQc(db,{testId:assay.id,instrumentId:instrument.id,assignments:lots.map((lot,i)=>({level:i+1,lotId:lot.id}))});
  const entry=createEntryHandlers(db),report=createReportHandlers(db),nce=createNceHandlers(db);
  const add=(level,val)=>must(entry.addPoint({data:{testId:assay.id,level,date:'2026-10-01',runId:'2026-10-01-1',val}},admin));
  const receive=()=>createIqcNce(nce,admin,assay.id,{date:'2026-10-01',runId:'2026-10-01-1'});
  return {db,config,instrument,assay,lots,operation,entry,report,nce,add,receive};
 }
 {
  const f=fixture();f.add(1,108);f.add(2,200);const before=nceQueueRows(f.db).length;
  const result=f.config.saveTest({id:f.assay.id,data:{name:'Glucose',instrumentIds:[f.instrument.id],assignmentIds:[f.assay.id],active:false}},admin);
  console.log(JSON.stringify({case:'R03 multi-instrument saveTest deactivation',queueBefore:before,result:{ok:result.ok,error:result.error},queueAfter:nceQueueRows(f.db).length,remainingPoints:f.db.prepare('SELECT count(*) n FROM qc_points WHERE voided=0').get().n}));f.db.close();
 }
 {
  const f=fixture();const p=f.add(1,105);f.add(2,190);f.receive();
  const before=f.report.getQcMonthlyReview('2026-10').totals;
  must(f.report.signQcMonthlyReview({data:{ym:'2026-10',conclusion:'action',note:'Cần khắc phục sự cố QC đã bị loại'}},admin));
  must(f.report.lockPeriod({data:{ym:'2026-10',acknowledge:true}},admin));
  const lot=must(f.config.saveLot({data:{lotNo:'NEW-1',level:1}},admin)); const secondLot=must(f.config.saveLot({data:{lotNo:'NEW-2',level:2}},admin)); must(f.config.saveLotGroup({data:{name:'Nhóm lô mới hợp lệ',lotIds:[lot.id,secondLot.id]}},admin));
  const change=f.config.saveTestLevel({testId:f.assay.id,data:{level:1,mean:100,sd:2,qcLotId:lot.id}},admin);
  const after=f.report.getQcMonthlyReview('2026-10');
  console.log(JSON.stringify({case:'R01 single-level lot change while old group still in use',change:{ok:change.ok,error:change.error},before,after:after.totals,rows:after.rows.map(r=>({level:r.level,rejected:r.rejected,unevaluated:r.unevaluated})),locked:f.report.isPeriodLocked('2026-10')}));
  must(f.report.unlockPeriod({data:{ym:'2026-10',note:'Mở lại kỳ để kiểm tra cổng huỷ điểm'}},admin));
  const result=f.entry.voidPoint({data:{pointId:p.id,kind:'data-entry',reason:''}},admin);
  console.log(JSON.stringify({case:'R05 old-lot R4s after moving only one level',result:{ok:result.ok,error:result.error},evidence:f.db.prepare('SELECT voided,void_rejection_json FROM qc_points WHERE id=?').get(p.id),group:f.db.prepare('SELECT status FROM lot_groups WHERE id=?').get(f.operation.groupId)}));f.db.close();
 }
 {
  const f=fixture();f.add(1,108);f.add(2,200);f.receive();
  const before=f.report.getQcMonthlyReview('2026-10').totals;
  must(f.report.signQcMonthlyReview({data:{ym:'2026-10',conclusion:'action',note:'Cần khắc phục sự cố QC đã bị loại'}},admin));
  must(f.report.lockPeriod({data:{ym:'2026-10',acknowledge:true}},admin));
  const result=f.config.stopLotGroup({id:f.operation.groupId},admin);
  console.log(JSON.stringify({case:'R01 manual stop after NCE and period lock',result:{ok:result.ok,error:result.error},before,after:f.report.getQcMonthlyReview('2026-10').totals,locked:f.report.isPeriodLocked('2026-10')}));f.db.close();
 }
 {
  const f=fixture();f.add(1,108);f.add(2,200);const before=nceQueueRows(f.db).length;
  const spare=must(f.config.saveLot({data:{lotNo:'SPARE',level:1}},admin));
  const result=f.config.saveLotGroup({data:{name:'Nhóm mới dự kiến',status:'planned',lotIds:[f.lots[0].id,spare.id]}},admin);
  console.log(JSON.stringify({case:'R03 create planned group using a lot currently in operation',queueBefore:before,result:{ok:result.ok,error:result.error},queueAfter:nceQueueRows(f.db).length,qcPoints:f.db.prepare('SELECT count(*) n FROM qc_points WHERE voided=0').get().n}));f.db.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
