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
  delete action.createdByUserId;delete action.createdByUsername;action.by='Quản trị';
  assert.equal(ctx.actionCanApprove(action,{id:'legacy-admin',username:'admin',name:'Quản trị'}),false,'legacy actions fall back to performer name');
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
  assert.equal(ctx.actionProtocolStatus(action).complete,false,'an open NCE is not yet ready for closure');
  assert.equal(ctx.actionWorkflowStatus(action).stage,'investigating');
}

{
  const complete={
    protocolVersion:2,nceId:'NCE-20260727-A002',eventSource:'iqc',processPhase:'exam',containmentStatus:'held',correction:'Dừng trả kết quả liên quan',by:'KTV A',dueDate:'2026-07-30',
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
    containmentStatus: 'held', correction: 'Dừng trả kết quả liên quan', by: 'KTV A', dueDate: '2099-01-01',
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
  const eff = ctx.actionEffectivenessStatus(action);
  assert.equal(eff.complete, true, 'đã chuyển hồ sơ tiếp theo thì không còn kẹt');
  assert.equal(eff.escalated, true);
  assert.match(eff.label, /NCE-20260728-B002/);
  assert.equal(ctx.actionWorkflowStatus(action).stage, 'approval', 'khép lại được với kết luận chưa hiệu lực');
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
  action.containmentStatus = 'held';
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

  assert.equal(ctx.actionDraftStatus({ ...draft, pointId: 'p1' }).complete, true, 'gắn điểm QC thì hợp lệ');
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

console.log('ActionWorkflowService tests passed');
