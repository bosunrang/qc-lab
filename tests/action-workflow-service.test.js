const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/action-workflow-service.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;}');

function fixture(actionOverrides = {}) {
  return {
    lab: {},
    instruments: [{ id: 'i1', name: 'Máy A' }],
    qcPanels: [{ id: 'panel1', name: 'Panel', instrumentId: 'i1', testIds: ['T1'], active: true }],
    qcLots: [{ id: 'lot1', groupId: 'g1', lotNo: 'L1', level: 1, active: true }],
    lotGroups: [{ id: 'g1', name: 'L1', lotIds: ['lot1'], active: true }],
    lotTransitions: [],
    assayGroups: [],
    periodLocks: [],
    users: [],
    actions: [Object.assign({
      id: 'a1',
      testId: 'T1',
      pointId: 'p1',
      level: 1,
      lot: 'L1',
      action: 'Hiệu chuẩn lại máy',
      by: 'KTV A',
      approvalStatus: 'pending',
    }, actionOverrides)],
    tests: [{
      id: 'T1',
      name: 'Glucose',
      instrumentId: 'i1',
      machine: 'Máy A',
      active: true,
      levels: [{ level: 1, qcLotId: 'lot1', lot: 'L1', mean: 10, sd: 1 }],
    }],
    data: { T1: [
      { id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, lot: 'L1', val: 14, qcMean: 10, qcSd: 1 },
      { id: 'p2', date: '2026-07-01', runId: '2026-07-01-2', level: 1, lot: 'L1', val: 10, qcMean: 10, qcSd: 1 },
    ] },
    sigmaData: {},
    reagentTests: [],
    reagentOperators: [],
    reagentSampleTypes: [],
    westgardRules: {},
    configMigrationVersion: 1,
  };
}

{
  ctx.__setState(fixture());
  const rerun = ctx.actionRerunStatus(ctx.__getState().actions[0]);
  assert.equal(rerun.needed, true);
  assert.equal(rerun.ok, true);
  assert.equal(rerun.point.id, 'p2');

  const wf = ctx.actionWorkflowStatus(ctx.__getState().actions[0]);
  assert.equal(wf.complete, false);
  assert.equal(wf.cls, 'warn');
  assert.match(wf.label, /Chờ duyệt/);
}

{
  const state = fixture();
  state.data.T1[1].val = 12.1;
  state.tests[0].ruleActions = Object.fromEntries(ctx.QCCore.WG_RULES.map(rule => [rule, rule === '1-2s' ? 'alert' : 'inactive']));
  ctx.__setState(state);
  const rerun = ctx.actionRerunStatus(ctx.__getState().actions[0]);
  assert.equal(rerun.ok, true, 'a warning-only rerun is operationally accepted because it is not a rejection');
  assert.equal(rerun.point.id, 'p2');
}

{
  const action=fixture().actions[0];
  action.createdByUserId='u1';action.createdByUsername='ktv-a';
  assert.equal(ctx.actionCanApprove(action,{id:'u1',username:'admin',name:'Quản trị'}),false,'creator cannot self-approve');
  assert.equal(ctx.actionCanApprove(action,{id:'u2',username:'admin',name:'Quản trị'}),true,'independent admin can approve');
  action.contentEditorUserIds=['u2'];action.contentEditorUsernames=['admin'];
  assert.equal(ctx.actionCanApprove(action,{id:'u2',username:'admin',name:'Quản trị'}),false,'a later content editor cannot approve the same record');
  assert.equal(ctx.actionCanApprove(action,{id:'u3',username:'reviewer',name:'Người duyệt'}),true,'a non-contributor can approve');
  delete action.createdByUserId;delete action.createdByUsername;action.by='Quản trị';
  delete action.contentEditorUserIds;delete action.contentEditorUsernames;
  assert.equal(ctx.actionCanApprove(action,{id:'legacy-admin',username:'admin',name:'Quản trị'}),false,'legacy actions fall back to performer name');
}

{
  const modern={
    protocolVersion:3,date:'2026-07-10',dueDate:'2026-07-09',eventSource:'eqa',processPhase:'exam',
    containmentStatus:'held',correction:'Dừng trả kết quả liên quan',by:'KTV A',
    riskSeverity:2,riskOccurrence:2,riskDetectability:2,riskLevel:'low',
    qcMaterialStatus:'ok',instrumentStatus:'ok',reagentStatus:'ok',calibrationStatus:'ok',lotToLotStatus:'not-needed',
    causeCategory:'operator',cause:'Thao tác chưa đúng',action:'Đào tạo lại thao tác',patientImpact:'none'
  };
  let status=ctx.actionProtocolStatus(modern);
  assert.equal(status.complete,false,'due date before incident must block closure');
  assert.ok(status.missing.some(x=>/hạn hoàn thành/.test(x)));
  modern.dueDate='2099-01-01';
  status=ctx.actionProtocolStatus(modern);
  assert.ok(status.missing.some(x=>/ngày hoàn thành hành động/.test(x)),'protocol v3 requires corrective-action completion date');
  modern.actionCompletedDate='2026-07-11';
  modern.effectivenessStatus='effective';modern.effectivenessDate='2026-07-10';modern.effectivenessNote='Không tái diễn sau theo dõi';
  assert.equal(ctx.actionEffectivenessStatus(modern).complete,false,'effectiveness cannot predate action completion');
  modern.effectivenessDate='2999-01-01';
  assert.equal(ctx.actionEffectivenessStatus(modern).complete,false,'future effectiveness date is invalid');
}

{
  ctx.__setState(fixture({ approvalStatus: 'approved' }));
  const wf = ctx.actionWorkflowStatus(ctx.__getState().actions[0]);
  assert.equal(wf.complete, true);
  assert.equal(wf.cls, 'ok');
}

{
  const structured={
    protocolVersion:1,containmentStatus:'held',
    qcMaterialStatus:'ok',instrumentStatus:'ok',reagentStatus:'abnormal',reagentNote:'Độ ổn định không đạt',calibrationStatus:'ok',lotToLotStatus:'not-needed',
    causeCategory:'reagent',cause:'Hóa chất suy giảm ổn định',patientImpact:'held',patientAction:'Đã giữ kết quả để chạy lại'
  };
  ctx.__setState(fixture({...structured,approvalStatus:'approved'}));
  const action=ctx.__getState().actions[0],protocol=ctx.actionProtocolStatus(action),wf=ctx.actionWorkflowStatus(action);
  assert.equal(protocol.complete,true);
  assert.match(ctx.actionProtocolSummary(action),/Hóa chất \/ calibrator: Bất thường/);
  assert.equal(wf.complete,true,'structured action closes after checklist, accepted rerun, and approval');
  action.patientAction='';
  assert.equal(ctx.actionProtocolStatus(action).complete,false);
  assert.equal(ctx.actionWorkflowStatus(action).complete,false,'incomplete patient-impact handling blocks closure');
}

{
  const draft={protocolVersion:2,nceId:'NCE-20260727-A001',eventSource:'iqc',processPhase:'exam',containmentStatus:'held',correction:'Dừng trả kết quả liên quan',by:'KTV A',dueDate:'2026-07-30',action:''};
  ctx.__setState(fixture(draft));
  const action=ctx.__getState().actions[0];
  assert.equal(ctx.actionDraftStatus(action).complete,true,'minimal containment data is enough to open an NCE');
  const protocol=ctx.actionProtocolStatus(action);
  assert.equal(protocol.complete,false,'an open NCE is not yet ready for closure');
  assert.ok(protocol.missing.some(x=>/ghi chú phạm vi/.test(x)),'giữ kết quả thì phải mô tả phạm vi đã giữ');
  action.containmentStatus='none';
  assert.ok(!ctx.actionProtocolStatus(action).missing.some(x=>/ghi chú phạm vi/.test(x)),'không có kết quả liên quan thì ghi chú phạm vi không bắt buộc');
  assert.equal(ctx.actionWorkflowStatus(action).stage,'investigating');
}

{
  const draft={protocolVersion:3,date:'2026-07-29',eventSource:'iqc',processPhase:'exam',containmentStatus:'none',correction:'Đã kiểm tra và cô lập kết quả liên quan',by:'KTV A',dueDate:'2099-01-01'};
  ctx.__setState(fixture(draft));
  const action=ctx.__getState().actions[0];
  assert.equal(ctx.actionDraftStatus(action).complete,true,'IQC bound to an existing point in the same test may open');
  let status=ctx.actionDraftStatus({...action,pointId:'missing'});
  assert.equal(status.complete,false,'an IQC record cannot rely on a stale or fabricated point id');
  assert.ok(status.missing.some(x=>/không còn tồn tại/.test(x)));
  status=ctx.actionDraftStatus({...action,testId:'T-KHAC'});
  assert.equal(status.complete,false,'the linked QC point must belong to the incident test');
  status=ctx.actionDraftStatus({...action,date:'2999-01-01'});
  assert.equal(status.complete,false,'a future incident date must block opening and closure');
  assert.ok(status.missingKeys.includes('date'));
}

{
  const complete={
    protocolVersion:2,nceId:'NCE-20260727-A002',eventSource:'iqc',processPhase:'exam',containmentStatus:'held',containmentNote:'Giữ kết quả từ 08:00',correction:'Dừng trả kết quả liên quan',by:'KTV A',dueDate:'2026-07-30',
    riskSeverity:4,riskOccurrence:2,riskDetectability:2,riskLevel:'high',
    qcMaterialStatus:'ok',instrumentStatus:'abnormal',instrumentNote:'Kim hút có cặn',reagentStatus:'ok',calibrationStatus:'ok',lotToLotStatus:'not-needed',
    causeCategory:'instrument',cause:'Kim hút bẩn làm sai thể tích hút',action:'Vệ sinh kim hút và cập nhật lịch bảo trì',patientImpact:'none',
    effectivenessStatus:'pending'
  };
  ctx.__setState(fixture(complete));
  const action=ctx.__getState().actions[0];
  assert.equal(ctx.actionRiskScore(action),16);
  assert.equal(ctx.actionWorkflowStatus(action).stage,'effectiveness','accepted rerun advances a complete investigation to effectiveness review');
  action.effectivenessStatus='effective';action.effectivenessDate='2026-07-28';action.effectivenessNote='Theo dõi các lần chạy sau không tái diễn';
  assert.equal(ctx.actionWorkflowStatus(action).stage,'approval');
  action.approvalStatus='approved';
  assert.equal(ctx.actionWorkflowStatus(action).stage,'closed');
  action.approvalStatus='pending';action.effectivenessStatus='ineffective';
  assert.equal(ctx.actionWorkflowStatus(action).stage,'effectiveness');
  assert.equal(ctx.actionWorkflowStatus(action).cls,'rej');
}

{
  const release={
    protocolVersion:3,date:'2026-07-01',nceId:'NCE-20260729-R001',eventSource:'iqc',processPhase:'exam',
    containmentStatus:'held',containmentNote:'Giữ kết quả từ đầu ca',correction:'Dừng trả kết quả liên quan',by:'KTV A',dueDate:'2099-01-01',
    riskSeverity:3,riskOccurrence:2,riskDetectability:2,riskLevel:'medium',riskBasis:'SOP-QC-07, ma trận nguy cơ bảng 3',
    qcMaterialStatus:'ok',instrumentStatus:'ok',reagentStatus:'ok',calibrationStatus:'ok',lotToLotStatus:'not-needed',
    causeCategory:'instrument',cause:'Kim hút bẩn làm sai thể tích hút',action:'Vệ sinh kim hút và cập nhật lịch bảo trì',actionCompletedDate:'2026-07-02',
    patientImpact:'none',effectivenessStatus:'pending'
  };
  const state=fixture(release);
  state.data.T1.push({id:'p3',date:'2026-07-03',runId:'2026-07-03-1',level:1,lot:'L1',val:10,qcMean:10,qcSd:1});
  ctx.__setState(state);
  const action=ctx.__getState().actions[0];
  let status=ctx.actionProtocolStatus(action);
  assert.equal(status.complete,false,'hồ sơ đã giữ kết quả không được khép vòng nếu chưa có quyết định cho phép trở lại');
  assert.ok(status.missing.some(x=>/quyết định cho phép/.test(x)));
  action.riskBasis='';
  assert.ok(ctx.actionProtocolStatus(action).missing.some(x=>/căn cứ phân loại nguy cơ/.test(x)),'mức nguy cơ thủ công phải có căn cứ SOP truy xuất được');
  action.riskBasis='SOP-QC-07, ma trận nguy cơ bảng 3';
  Object.assign(action,{releaseStatus:'released',releaseDate:'2026-07-03',releaseBy:'Phụ trách khoa',releaseNote:'QC chạy lại đã được chấp nhận'});
  assert.equal(ctx.actionProtocolStatus(action).complete,true,'quyết định đầy đủ sau QC đạt lại hoàn tất cổng cho phép trở lại');
  action.releaseDate='2026-07-01';
  assert.ok(ctx.actionProtocolStatus(action).missing.some(x=>/trước ngày hoàn thành hành động/.test(x)));
  action.releaseDate='2999-01-01';
  assert.ok(ctx.actionProtocolStatus(action).missing.some(x=>/không được ở tương lai/.test(x)));
  action.releaseDate='2026-07-03';state.data.T1.pop();
  assert.ok(ctx.actionProtocolStatus(action).missing.some(x=>/QC chạy lại được chấp nhận/.test(x)),'không được mở lại trước bằng chứng QC được chấp nhận');
  action.containmentStatus='none';action.releaseStatus='';action.releaseDate='';action.releaseBy='';action.releaseNote='';
  assert.equal(ctx.actionProtocolStatus(action).complete,true,'không giữ kết quả thì không phát sinh thủ tục cho phép trở lại');
}

{
  const effective={
    protocolVersion:3,date:'2026-07-01',actionCompletedDate:'2026-07-02',releaseDate:'2026-07-03',
    riskSeverity:3,riskOccurrence:2,riskDetectability:2,riskLevel:'medium',
    effectivenessStatus:'effective',effectivenessDate:'2026-07-10',effectivenessNote:'Theo dõi các lần chạy sau không tái diễn'
  };
  let status=ctx.actionEffectivenessStatus(effective);
  assert.equal(status.complete,false,'không được kết luận có hiệu lực nếu chưa đánh giá nguy cơ còn lại');
  assert.match(status.label,/nguy cơ còn lại/);
  Object.assign(effective,{residualSeverity:3,residualOccurrence:1,residualDetectability:1,residualRiskLevel:'low',residualRiskBasis:'Đánh giá lại theo SOP-QC-07'});
  status=ctx.actionEffectivenessStatus(effective);
  assert.equal(status.complete,true,'nguy cơ còn lại đầy đủ và không tăng cho phép xác nhận hiệu lực');
  assert.equal(ctx.actionResidualRiskScore(effective),3);
  assert.match(status.label,/RPN còn lại 3/);
  Object.assign(effective,{residualSeverity:5,residualOccurrence:5,residualDetectability:5});
  status=ctx.actionEffectivenessStatus(effective);
  assert.equal(status.complete,false,'RPN còn lại cao hơn ban đầu mâu thuẫn với kết luận có hiệu lực');
  assert.match(status.label,/cao hơn RPN ban đầu/);
}

{
  ctx.__setState(fixture({ action: '', by: '' }));
  const wf = ctx.actionWorkflowStatus(ctx.__getState().actions[0]);
  assert.equal(wf.complete, false);
  assert.equal(wf.cls, 'rej');
  assert.equal(ctx.pointWorkflowSummary('p1').label, 'Chưa ghi khắc phục');
}

{
  const state = fixture();
  state.data.T1[0].voided = true;
  state.data.T1[1].voided = true;
  state.data.T1.push({ id: 'p3', date: '2026-07-02', runId: '2026-07-02-1', level: 1, lot: 'L1', val: 10, qcMean: 10, qcSd: 1 });
  ctx.__setState(state);
  const rerun = ctx.actionRerunStatus(ctx.__getState().actions[0]);
  assert.equal(rerun.needed, true, 'điểm đã hủy vẫn phải yêu cầu chạy lại QC');
  assert.equal(rerun.ok, true, 'QC chạy lại vào ngày sau phải được nhận diện');
  assert.equal(rerun.point.id, 'p3');
}

{
  /* QC chạy lại trước khi hành động hoàn thành không chứng minh được hiệu lực của
     hành động đó. Chỉ điểm từ ngày hoàn thành trở đi mới đủ điều kiện. */
  const state=fixture({protocolVersion:3,actionCompletedDate:'2026-07-03'});
  state.data.T1.push({id:'p3',date:'2026-07-03',runId:'2026-07-03-1',level:1,lot:'L1',val:10,qcMean:10,qcSd:1});
  ctx.__setState(state);
  const rerun=ctx.actionRerunStatus(ctx.__getState().actions[0]);
  assert.equal(rerun.ok,true);
  assert.equal(rerun.point.id,'p3','không được dùng p2 vì p2 có trước ngày hoàn thành hành động');
  state.data.T1.pop();
  assert.equal(ctx.actionRerunStatus(ctx.__getState().actions[0]).ok,false,'chỉ có QC trước hành động thì vẫn phải chờ chạy lại');
}

{
  const state=fixture({protocolVersion:3,actionCompletedDate:'',parentNceId:'NCE-TRUOC',date:'2026-07-03'});
  ctx.__setState(state);
  let rerun=ctx.actionRerunStatus(ctx.__getState().actions[0]);
  assert.equal(rerun.ok,false,'hồ sơ v3 chưa hoàn thành hành động không được nhận trước bằng chứng QC');
  assert.match(rerun.label,/Chờ hoàn thành hành động/);
  const action=ctx.__getState().actions[0];
  action.actionCompletedDate='2026-07-04';
  state.data.T1.push({id:'p3',date:'2026-07-04',runId:'2026-07-04-1',level:1,lot:'L1',val:10,qcMean:10,qcSd:1});
  rerun=ctx.actionRerunStatus(action);
  assert.equal(rerun.point.id,'p3','hồ sơ nối tiếp phải dùng QC của vòng mới, không tái sử dụng p2 từ vòng trước');
}

{
  const state=fixture();
  state.data.T1[0].voided=true;
  state.data.T1[0].voidKind='data-entry';
  state.data.T1[0].voidRequiresRerun=false;
  ctx.__setState(state);
  const rerun=ctx.actionRerunStatus(ctx.__getState().actions[0]);
  assert.equal(rerun.needed,false,'điểm hủy do nhập sai dữ liệu không bắt chạy lại QC');
}

{
  // nextNceId()/nceDueDate() dùng chung cho trang Actions và luồng hủy điểm ở
  // entry-routes — mã phải duy nhất trong state, kể cả khi mã đó đã tồn tại.
  const state = fixture();
  state.actions[0].nceId = 'NCE-20260727-AAAA';
  ctx.__setState(state);
  run(ctx, "var __uidQueue=['xxxxaaaa','xxxxbbbb']; uid=function(){return __uidQueue.shift()||'xxxxcccc';};");
  const first = ctx.nextNceId('2026-07-27');
  assert.equal(first, 'NCE-20260727-BBBB', 'mã trùng bị bỏ qua thay vì cấp lại');
  assert.match(ctx.nceDueDate(7), /^\d{4}-\d{2}-\d{2}$/);
  const now = new Date(), localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(ctx.nceDueDate(0), localToday, 'hạn xử lý tính theo ngày địa phương, không phải UTC');
}

{
  // Regression 2026-07-27: nceDueDate() từng dùng toISOString() (giờ UTC) nên ở
  // UTC+7, từ 0h–7h sáng hạn xử lý bị lùi 1 ngày so với ngày địa phương mà toàn
  // app dùng. Date giả dưới đây có ngày địa phương 2026-08-03 nhưng toISOString()
  // vẫn là 2026-08-02 — bản cũ trả '2026-08-02', bản đúng phải trả '2026-08-03'.
  // Bắt/trả Date phải làm BÊN TRONG vm: builtin của context không phải thuộc tính
  // riêng của object sandbox, nên ctx.Date đọc từ ngoài luôn là undefined.
  run(ctx, "globalThis.__realDate=Date;Date=class{constructor(){this._d=3;}getDate(){return this._d;}getMonth(){return 7;}getFullYear(){return 2026;}setDate(d){this._d=d;}toISOString(){return '2026-08-02T19:00:00.000Z';}};");
  assert.equal(ctx.nceDueDate(0), '2026-08-03', 'hạn xử lý theo lịch địa phương kể cả khi UTC vẫn là ngày hôm trước');
  assert.equal(ctx.nceDueDate(7), '2026-08-10');
  run(ctx, 'Date=globalThis.__realDate;delete globalThis.__realDate;');
  assert.equal(typeof run(ctx, 'new Date().getFullYear()'), 'number', 'Date thật phải được trả lại cho các test sau');
}

{
  // "Chưa hiệu lực" phải escalate chứ không treo hồ sơ vô thời hạn: khi đã chuyển
  // sang hồ sơ tiếp theo, hồ sơ này khép lại được với kết luận "chưa hiệu lực".
  const closed = {
    protocolVersion: 2, nceId: 'NCE-20260727-B001', eventSource: 'iqc', processPhase: 'exam',
    containmentStatus: 'held', containmentNote: 'Giữ kết quả từ 08:00', correction: 'Dừng trả kết quả liên quan', by: 'KTV A', dueDate: '2099-01-01',
    riskSeverity: 3, riskOccurrence: 2, riskDetectability: 2, riskLevel: 'medium',
    qcMaterialStatus: 'ok', instrumentStatus: 'ok', reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
    causeCategory: 'instrument', cause: 'Kim hút bẩn làm sai thể tích', action: 'Vệ sinh kim hút và cập nhật lịch bảo trì',
    patientImpact: 'none', effectivenessStatus: 'ineffective',
  };
  ctx.__setState(fixture(closed));
  const action = ctx.__getState().actions[0];
  assert.equal(ctx.actionEffectivenessStatus(action).complete, false, 'chưa chuyển hồ sơ thì vẫn bị chặn');
  assert.equal(ctx.actionWorkflowStatus(action).stage, 'effectiveness');
  action.followUpNceId = 'NCE-20260728-B002';
  ctx.__getState().actions.push({id:'a2',nceId:'NCE-20260728-B002',parentNceId:action.nceId,recordStatus:'active'});
  const eff = ctx.actionEffectivenessStatus(action);
  assert.equal(eff.complete, true, 'đã chuyển hồ sơ tiếp theo thì không còn kẹt');
  assert.equal(eff.escalated, true);
  assert.match(eff.label, /NCE-20260728-B002/);
  assert.equal(ctx.actionWorkflowStatus(action).stage, 'approval', 'khép lại được với kết luận chưa hiệu lực');
  ctx.__getState().actions[1].recordStatus='cancelled';
  assert.equal(ctx.actionEffectivenessStatus(action).complete,false,'hồ sơ nối tiếp đã hủy không được dùng để khép vòng hồ sơ cha');
  assert.equal(ctx.actionActiveFollowUp(action),null);
}

{
  // Mục 1 ghi "không có kết quả liên quan" mà mục 7 lại kết luận có kết quả bị ảnh
  // hưởng là hồ sơ tự mâu thuẫn — không cho khép vòng.
  const conflicting = {
    protocolVersion: 2, eventSource: 'iqc', processPhase: 'exam', containmentStatus: 'none',
    correction: 'Dừng trả kết quả liên quan', by: 'KTV A', dueDate: '2099-01-01',
    riskSeverity: 2, riskOccurrence: 2, riskDetectability: 2, riskLevel: 'low',
    qcMaterialStatus: 'ok', instrumentStatus: 'ok', reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
    causeCategory: 'operator', cause: 'Thao tác hút mẫu chưa đúng', action: 'Đào tạo lại thao tác hút mẫu',
    patientImpact: 'affected', patientAction: 'Chạy lại các mẫu liên quan',
    effectivenessStatus: 'effective', effectivenessDate: '2026-07-28', effectivenessNote: 'Không tái diễn sau theo dõi',
  };
  ctx.__setState(fixture(conflicting));
  const action = ctx.__getState().actions[0];
  const protocol = ctx.actionProtocolStatus(action);
  assert.equal(protocol.complete, false);
  assert.ok(protocol.missing.some(m => /mâu thuẫn/.test(m)), 'phải nêu rõ mâu thuẫn giữa mục 1 và mục 7');
  action.containmentStatus = 'held';action.containmentNote = 'Giữ kết quả từ 08:00';
  assert.equal(ctx.actionProtocolStatus(action).complete, true, 'giữ kết quả rồi kết luận có ảnh hưởng là hợp lệ');
}

{
  // Quá hạn chỉ tính cho hồ sơ còn mở.
  const base = {
    protocolVersion: 2, eventSource: 'iqc', processPhase: 'exam', containmentStatus: 'held',
    correction: 'Dừng trả kết quả liên quan', by: 'KTV A', dueDate: '2020-01-01',
  };
  ctx.__setState(fixture(base));
  const action = ctx.__getState().actions[0];
  const over = ctx.actionOverdue(action);
  assert.equal(over.overdue, true);
  assert.ok(over.days > 2000, 'đếm đúng số ngày trễ');
  assert.match(over.label, /^Quá hạn \d+ ngày$/);
  action.dueDate = '2099-01-01';
  assert.equal(ctx.actionOverdue(action).overdue, false, 'chưa tới hạn thì không cảnh báo');
  action.dueDate = '';
  assert.equal(ctx.actionOverdue(action).overdue, false, 'không có hạn thì không cảnh báo');
}

{
  /* Sự cố nội kiểm phải gắn một điểm QC. Không gắn thì actionPoint() trả null ->
     actionNeedsRerun() false -> hồ sơ khép vòng được mà KHÔNG cần bằng chứng QC chạy
     lại. Tức là mở hồ sơ thủ công rồi chọn nguồn "Nội kiểm IQC" là đường vòng né đúng
     rào an toàn quan trọng nhất của quy trình. */
  const draft = {
    protocolVersion: 2, nceId: 'NCE-20260728-C001', eventSource: 'iqc', processPhase: 'exam',
    containmentStatus: 'held', correction: 'Dừng trả kết quả liên quan', by: 'KTV A', dueDate: '2099-01-01',
  };
  const unbound = { ...draft, pointId: '' };
  const status = ctx.actionDraftStatus(unbound);
  assert.equal(status.complete, false, 'nguồn IQC mà không gắn điểm QC thì không được mở hồ sơ');
  assert.ok(status.missing.some(m => /mở từ dòng vi phạm/.test(m)), status.missing.join('; '));
  assert.ok(status.missingKeys.includes('eventSource'));

  ctx.__setState(fixture(draft));
  assert.equal(ctx.actionDraftStatus({ ...draft, testId: 'T1', pointId: 'p1' }).complete, true, 'gắn điểm QC thực sự thuộc xét nghiệm thì hợp lệ');
  assert.equal(ctx.actionDraftStatus({ ...draft, testId: 'T1', pointId: 'khong-ton-tai' }).complete, false, 'mã điểm QC giả hoặc đã mất không được coi là liên kết hợp lệ');
  assert.equal(ctx.actionDraftStatus({ ...unbound, eventSource: 'eqa' }).complete, true, 'nguồn ngoài IQC không cần điểm QC');
  assert.equal(ctx.actionDraftStatus({ ...unbound, eventSource: 'clinical' }).complete, true);

  // Rào này phải chặn cả lúc khép vòng, không chỉ lúc mở.
  ctx.__setState(fixture({ ...unbound, riskSeverity: 2, riskOccurrence: 2, riskDetectability: 2, riskLevel: 'low',
    qcMaterialStatus: 'ok', instrumentStatus: 'ok', reagentStatus: 'ok', calibrationStatus: 'ok', lotToLotStatus: 'not-needed',
    causeCategory: 'operator', cause: 'Thao tác chưa đúng', action: 'Đào tạo lại thao tác', patientImpact: 'none',
    effectivenessStatus: 'effective', effectivenessDate: '2026-07-28', effectivenessNote: 'Không tái diễn sau theo dõi' }));
  const action = ctx.__getState().actions[0];
  action.pointId = '';
  assert.equal(ctx.actionProtocolStatus(action).complete, false, 'không khép vòng được khi nguồn IQC mà thiếu điểm QC');
}

{
  const state=fixture({approvalStatus:'approved',recordStatus:'cancelled',cancelReason:'Mở nhầm điểm QC',cancelledBy:'Quản trị',cancelledAt:'2026-07-29T02:00:00.000Z'});
  ctx.__setState(state);
  const action=ctx.__getState().actions[0],wf=ctx.actionWorkflowStatus(action);
  assert.equal(ctx.actionRecordStatus(action),'cancelled');
  assert.equal(ctx.actionApprovalLabel(action),'Đã hủy hồ sơ');
  assert.equal(wf.stage,'cancelled');
  assert.equal(wf.complete,false,'hủy hồ sơ không được tính là khép vòng hợp lệ');
  assert.equal(ctx.pointWorkflowComplete('p1'),false,'vi phạm QC phải xuất hiện lại sau khi hồ sơ của nó bị hủy');
  assert.equal(ctx.pointRealActions('p1').length,0,'hồ sơ hủy chỉ còn trong lịch sử, không được dùng làm hành động đang xử lý');
  assert.equal(ctx.actionOverdue(action).overdue,false,'hồ sơ hủy không còn bị tính quá hạn');
  assert.equal(ctx.actionCanApprove(action,{id:'u2',username:'admin'}),false,'hồ sơ hủy không thể được duyệt');
}

{
  /* actionRerunStatus() bị gọi 5 lần cho CÙNG một hồ sơ trong một lần vẽ
     (actionWorkflowStatus -> actionProtocolStatus nhánh release -> actionEffectivenessStatus),
     và trước đây mỗi lần quét lại toàn bộ state.data[testId]: 5 894ms mỗi lần vẽ với
     40 000 điểm × 600 hồ sơ, còn 171ms sau khi thêm index theo (xét nghiệm, mức, lô) và
     memo. CỐ Ý KHÔNG chốt bằng mốc thời gian: hai tối ưu che lẫn nhau nên đo thời gian
     không phân biệt được cái nào hỏng (đã thử — bỏ index lại cho tỉ lệ NHỎ hơn giữ
     index), mà số đo còn flake theo tải máy. Thay vào đó chốt tính đúng đắn của cache:
     nó phải tự trượt, vì đó mới là chỗ dễ hỏng âm thầm. */
  // Memo phải tự trượt khi dữ liệu QC đổi, không trông chờ ai gọi clearDerived.
  // clearDerived() ở đây chỉ để dọn wgMemo còn sót từ khối đo phía trên (wgMemo dùng
  // chung khoá testId nên rò giữa các khối test), không phải điều kiện của phép thử.
  ctx.__setState(fixture());
  ctx.clearDerived();
  assert.equal(ctx.actionRerunStatus(ctx.__getState().actions[0]).ok, true);
  ctx.__getState().data.T1.pop();
  assert.equal(ctx.actionRerunStatus(ctx.__getState().actions[0]).ok, false, 'bớt điểm QC phải làm memo trượt ngay');
  ctx.__setState(fixture());
  assert.equal(ctx.actionRerunStatus(ctx.__getState().actions[0]).ok, true, 'thay nguyên state phải làm memo trượt ngay');
  ctx.clearDerived();
  const action = ctx.__getState().actions[0];
  action.protocolVersion = 3; action.actionCompletedDate = '';
  assert.equal(ctx.actionRerunStatus(action).ok, false, 'đổi chính hồ sơ cũng phải làm memo trượt');
}

console.log('ActionWorkflowService tests passed');
