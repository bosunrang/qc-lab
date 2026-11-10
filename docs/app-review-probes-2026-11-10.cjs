// Ca thử quan sát cho đợt rà soát 10/11/2026. Chỉ dùng CSDL trong bộ nhớ.
// In bằng chứng của hành vi hiện tại; không thay thế kiểm thử hồi quy chính thức.
// Chạy sau npm run build: node docs/app-review-probes-2026-11-10.cjs
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = process.argv[2] || path.resolve(__dirname, '..');
const load = p => require(path.join(root, 'app-dist/main', p));
const { openDatabase } = load('db/open-database.js');
const { createConfigHandlers } = load('ipc/config-handlers.js');
const { createEntryHandlers } = load('ipc/entry-handlers.js');
const { createReportHandlers } = load('ipc/report-handlers.js');
const { createEqaHandlers } = load('ipc/eqa-handlers.js');
const { nceQueueRows } = load('db/nce-evaluation.js');
const admin = {userId:'review-admin', username:'review', name:'Người rà soát', role:'admin', clientId:'review'};
function must(r){if(!r?.ok) throw new Error(JSON.stringify(r));return r.data;}
(async()=>{
const { makeOperationalQc } = await import(pathToFileURL(path.join(root,'app/tests/helpers/operational-fixture.mjs')));
function qc(){
 const db=openDatabase(':memory:');const config=createConfigHandlers(db);
 const instrument=must(config.saveInstrument({data:{name:'Máy kiểm tra'}},admin));
 const assay=must(config.saveTest({data:{name:'Glucose',instrumentId:instrument.id}},admin));
 const lots=[];
 for(const [level,mean,sd] of [[1,100,2],[2,200,4]]){
  const lot=must(config.saveLot({data:{lotNo:'REVIEW-L'+level,level}},admin));lots.push(lot);
  must(config.saveTestLevel({testId:assay.id,data:{level,mean,sd,qcLotId:lot.id}},admin));
 }
 const operation=makeOperationalQc(db,{testId:assay.id,instrumentId:instrument.id,assignments:lots.map((lot,i)=>({level:i+1,lotId:lot.id}))});
 const entry=createEntryHandlers(db), report=createReportHandlers(db);
 const add=(level,date,val)=>must(entry.addPoint({data:{testId:assay.id,level,date,val,runId:date+'-1'}},admin));
 return {db,config,instrument,assay,lots,entry,report,add,operation};
}
{
 const f=qc();const eqa=createEqaHandlers(f.db);
 const round={program:'VEQAS REVIEW',provider:'TTKCXN',programCode:'BC20C',unitCode:'REVIEW',year:2026,round:'ĐỢT 09',reportCode:'R-09',reportDate:'2026-10-20',assignedLevel:''};
 const draft=(sample,z,extra={})=>({data:{round,rows:[{ref:sample,code:'Glucose',instrument:'Máy kiểm tra',sample,unit:'mmol/L',result:100+z*2,assigned:100,sigmaP:2,zProvider:z,method:'',peerGroup:'',peer:{}}],mappings:[{code:'Glucose',instrument:'Máy kiểm tra',testId:f.assay.id}],source:'pdf',sourceName:sample+'.pdf',...extra}});
 const first=must(eqa.importEqaRound(draft('09-01',3.2),admin));const attentionBefore=eqa.listEqaAttention().length;
 const second=must(eqa.importEqaRound(draft('09-02',0.5,{replaceReason:'Bổ sung mẫu thứ hai cùng đợt',expectedVersion:first.round.row_version}),admin));
 console.log(JSON.stringify({case:'EQA same instrument distinct samples',before:first.results.map(r=>({sample:r.sample,z:r.z_official})),after:second.results.map(r=>({sample:r.sample,z:r.z_official})),attentionBefore,attentionAfter:eqa.listEqaAttention().length,oldRowsStillInHistory:f.db.prepare('SELECT count(*) n FROM eqa_results WHERE version=1').get().n}));
 f.db.close();
}
{
 const f=qc();f.add(1,'2026-10-01',100);f.add(2,'2026-10-01',200);
 const sign=must(f.report.signQcMonthlyReview({data:{ym:'2026-10',conclusion:'ok',note:''}},admin));
 const before=JSON.parse(f.db.prepare('SELECT summary_json FROM qc_month_reviews WHERE id=?').get(sign.id).summary_json).totals.points;
 f.add(1,'2026-10-02',101);f.add(2,'2026-10-02',201);
 const lock=f.report.lockPeriod({data:{ym:'2026-10'}},admin);
 console.log(JSON.stringify({case:'Lock after data changed since signature',signedPoints:before,currentPoints:f.report.getQcMonthlyReview('2026-10').totals.points,lock}));
 const future=f.report.lockPeriod({data:{ym:'2027-03',acknowledge:true}},admin);
 console.log(JSON.stringify({case:'Future month lock',result:future}));f.db.close();
}
{
 const f=qc();f.add(1,'2026-10-01',108);f.add(2,'2026-10-01',200);
 const before=nceQueueRows(f.db).length;
 const result=f.config.savePanel({id:f.operation.panelId,data:{name:'Panel ngừng hoạt động',instrumentId:f.instrument.id,active:false,testIds:[f.assay.id]}},admin);
 console.log(JSON.stringify({case:'Pending rejected run after deactivate panel',queueBefore:before,deactivate:result.ok,queueAfter:nceQueueRows(f.db).length,qcPoints:f.db.prepare('SELECT count(*) n FROM qc_points WHERE voided=0').get().n}));f.db.close();
}
{
 const f=qc();const p=f.add(1,'2026-10-01',105);f.add(2,'2026-10-01',190);
 const before=f.entry.queryPoints(f.assay.id,1).map(p=>({verdict:p.verdict,rules:p.rules}));
 for(const level of [1,2]){
  const newLot=must(f.config.saveLot({data:{lotNo:'NEW-'+level,level}},admin));
  must(f.config.saveTestLevel({testId:f.assay.id,data:{level,mean:level===1?100:200,sd:level===1?2:4,qcLotId:newLot.id}},admin));
 }
 const result=f.entry.voidPoint({data:{pointId:p.id,kind:'data-entry',reason:''}},admin);
 console.log(JSON.stringify({case:'Old lot cross-level rejection void without reason',before,result,evidence:f.db.prepare('SELECT voided,void_rejection_json FROM qc_points WHERE id=?').get(p.id)}));f.db.close();
}
{
 const f=qc();f.add(1,'2026-10-01',108);f.add(2,'2026-10-01',200);
 const before=f.report.getQcMonthlyReview('2026-10').totals;
 must(f.report.signQcMonthlyReview({data:{ym:'2026-10',conclusion:'action',note:'Cần khắc phục lần QC đã bị loại'}},admin)); must(f.report.lockPeriod({data:{ym:'2026-10',acknowledge:true}},admin)); const stopped=f.config.stopLotGroup({id:f.operation.groupId},admin);
 const after=f.report.getQcMonthlyReview('2026-10');
 const details=f.report.queryReport({testId:f.assay.id,from:'2026-10-01',to:'2026-10-31'}).map(p=>({level:p.level,verdict:p.verdict,accepted:p.accepted}));
 console.log(JSON.stringify({case:'Monthly review after manually stopping group',before,stopped,periodStillLocked:f.report.isPeriodLocked('2026-10'),after:after.totals,unevaluated:after.rows.map(r=>r.unevaluated),details}));f.db.close();
}
})().catch(e=>{console.error(e);process.exitCode=1;});




