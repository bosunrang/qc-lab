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

console.log('ActionWorkflowService tests passed');
