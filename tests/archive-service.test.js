const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { loadSandbox } = require('./helpers/sandbox');

(async()=>{
  const ctx=loadSandbox(['core.js','modules/archive-service.js','modules/backup-service.js'],{crypto:webcrypto});
  const state={schemaVersion:ctx.QCCore.STATE_SCHEMA_VERSION,lab:{name:'PXN A'},tests:[{id:'T1',name:'Glucose',levels:[{level:1}]}],users:[{id:'u1',username:'admin',passHash:'secret'}],
    data:{T1:[{id:'p25',date:'2025-12-31',runId:'2025-12-31-1',level:1,val:1},{id:'p26a',date:'2026-01-01',runId:'2026-01-01-1',level:1,val:2},{id:'p26b',date:'2026-06-01',runId:'2026-06-01-1',level:1,val:3}],T2:[{id:'p27',date:'2027-01-01',runId:'2027-01-01-1',level:1,val:4}]},
    actions:[{id:'a1',pointId:'p26a'},{id:'a2',eventDate:'2025-12-31'}],activity:[{id:'l1',ts:'2026-02-01T00:00:00Z'},{id:'l2',ts:'2025-02-01T00:00:00Z'}],
    sigmaData:{T1:[{period:'2026-01'},{period:'2025-12'}]},periodLocks:[{ym:'2026-01'},{ym:'2025-12'}],reagentTests:[{id:'r1',test:{date:'2026-03-01'}},{id:'r2',test:{date:'2025-03-01'}}]};

  assert.deepEqual([...ctx.ArchiveService.availableYears(state)],['2027','2026','2025']);
  const built=ctx.ArchiveService.build(state,'2026'),plain=JSON.parse(JSON.stringify(built));
  assert.equal(plain.summary.points,2);
  assert.deepEqual(plain.state.data.T1.map(p=>p.id),['p26a','p26b']);
  assert.equal(plain.state.users.length,0,'archive không chứa hash mật khẩu');
  assert.deepEqual(plain.state.actions.map(a=>a.id),['a1']);
  assert.deepEqual(plain.state.activity.map(a=>a.id),['l1']);
  assert.equal(plain.state.sigmaData.T1.length,1);
  assert.equal(plain.state.periodLocks.length,1);
  assert.equal(plain.state.reagentTests.length,1);
  assert.equal(ctx.ArchiveService.build(state,'2024').error,'empty-year');
  assert.equal(ctx.ArchiveService.build(state,'26').error,'invalid-year');

  const pack=await ctx.createBackupPackage(built.state,{type:'year-archive',year:'2026'}),report=await ctx.inspectBackupText(pack.text,pack.bytes);
  assert.equal(report.meta.type,'year-archive');
  assert.equal(report.meta.year,'2026');
  assert.equal(report.meta.checksumStatus,'verified');
  assert.equal(report.summary.points,2);
  await assert.rejects(()=>ctx.prepareBackupImport(pack.text),/archive theo năm/);

  const registryState={archiveRegistry:[]},input={id:'arc1',year:'2026',filename:'archive.json',checksum:report.meta.checksum,sizeBytes:pack.bytes,points:2,tests:1,minDate:'2026-01-01',maxDate:'2026-06-01',verifiedAt:'2026-08-01T10:00:00Z',testCounts:report.summary.testCounts};
  assert.equal(ctx.ArchiveService.register(registryState,input).added,true);
  assert.equal(ctx.ArchiveService.register(registryState,{...input,id:'arc2'}).added,false,'cùng năm+checksum không được đăng ký hai lần');
  assert.equal(ctx.ArchiveService.evidenceForDate(registryState,'2026-05-01').id,`arc_2026_${report.meta.checksum.slice(0,24)}`);
  assert.equal(ctx.ArchiveService.evidenceForDate(registryState,'2025-05-01'),null);

  const archiveState=JSON.parse(JSON.stringify(built.state)),same=ctx.ArchiveService.compareYear(state,archiveState,'2026');
  assert.equal(same.ok,true,'phải đối chiếu đúng từng test/id/nội dung điểm');
  assert.equal(same.currentPoints,2);
  archiveState.data.T1[0].val=99;
  const changed=ctx.ArchiveService.compareYear(state,archiveState,'2026');
  assert.equal(changed.ok,false);
  assert.equal(changed.changed.length,1,'cùng id nhưng đổi nội dung phải bị chặn');
  archiveState.data.T1.shift();
  const missing=ctx.ArchiveService.compareYear(state,archiveState,'2026');
  assert.equal(missing.missing.length,1,'điểm có trong state nhưng thiếu trong archive phải bị chặn');
  archiveState.data.T1.push({id:'extra',date:'2026-09-01',level:1,val:5});
  const extra=ctx.ArchiveService.compareYear(state,archiveState,'2026');
  assert.equal(extra.extra.length,1,'điểm dư trong archive phải bị chặn');

  const before2025=state.data.T1[0],before2027=state.data.T2[0],removal=ctx.ArchiveService.removeYearPoints(state,'2026');
  assert.equal(removal.removed,2);
  assert.deepEqual(state.data.T1.map(p=>p.id),['p25']);
  assert.equal(state.data.T1[0],before2025,'không được dựng lại điểm ngoài năm cần dọn');
  assert.equal(state.data.T2[0],before2027,'xét nghiệm không bị tác động phải giữ nguyên');
  ctx.ArchiveService.restoreRemovedPoints(state,removal);
  assert.deepEqual(state.data.T1.map(p=>p.id),['p25','p26a','p26b'],'rollback phải khôi phục nguyên mảng điểm');

  console.log('Year archive service tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
