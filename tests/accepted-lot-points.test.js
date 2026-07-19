const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;clearDerived();}');
const plain = value => JSON.parse(JSON.stringify(value));

function baseState(points) {
  const rules = Object.fromEntries(ctx.QCCore.WG_RULES.map(rule => [rule, ['1-2s','1-3s'].includes(rule)]));
  return {
    lab: {}, machines: [], instruments: [{ id: 'i1', name: 'Analyzer A', active: true }], assayGroups: [],
    qcPanels: [{ id: 'p1', name: 'Panel A', instrumentId: 'i1', testIds: ['T1'], active: true }],
    lotTransitions: [], lotGroups: [{ id: 'g1', name: 'L1', lotIds: ['lot1'], active: true }],
    qcLots: [{ id: 'lot1', groupId: 'g1', lotNo: 'L1', level: 1, exp: '2026-12-31', active: true }],
    tests: [{ id: 'T1', name: 'Glucose', unit: 'mmol/L', instrumentId: 'i1', machine: 'Analyzer A', active: true,
      levels: [{ level: 1, qcLotId: 'lot1', lot: 'L1', mean: 100, sd: 10, exp: '2026-12-31' }] }],
    data: { T1: points }, actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [],
    reagentSampleTypes: [], sigmaData: {}, periodLocks: [], westgardRules: rules, configMigrationVersion: 1,
  };
}

{
  const points = [
    { id: 'run1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, lot: 'L1', val: 100, qcMean: 100, qcSd: 10 },
    { id: 'run2', date: '2026-07-01', runId: '2026-07-01-2', level: 1, lot: 'L1', val: 101, qcMean: 100, qcSd: 10 },
    { id: 'warning', date: '2026-07-02', runId: '2026-07-02-1', level: 1, lot: 'L1', val: 121, qcMean: 100, qcSd: 10 },
    { id: 'rejected', date: '2026-07-03', runId: '2026-07-03-1', level: 1, lot: 'L1', val: 131, qcMean: 100, qcSd: 10 },
    { id: 'recovery', date: '2026-07-03', runId: '2026-07-03-2', level: 1, lot: 'L1', val: 99, qcMean: 100, qcSd: 10 },
  ];
  ctx.__setState(baseState(points));
  const t = ctx.__getState().tests[0];
  const actual = plain(ctx.acceptedLotPoints(t, 1).map(point => point.id));

  assert.deepEqual(actual, ['run1','run2','warning','recovery'], 'keep every accepted analytical run, including warnings, and exclude rejected runs');
  assert.ok(actual.includes('run1') && actual.includes('run2'), 'two valid runs on one day must both contribute to statistics');
  assert.ok(actual.includes('warning'), 'a warning is not a rejection and remains in the accepted series');
  assert.ok(!actual.includes('rejected'), 'a rejected run must not contribute to accepted statistics');
}

{
  const running = baseState([]);
  ctx.__setState(running);
  assert.equal(ctx.operationalTests().length, 1, 'nhóm đang hoạt động phải xuất hiện trong Nhập QC');
  assert.equal(ctx.canEnterQcForLevel(ctx.__getState().tests[0], 1), true);

  const stopped = baseState([]);
  stopped.lotGroups[0].status = 'stopped';
  stopped.lotGroups[0].stoppedAt = '2026-07-16';
  ctx.__setState(stopped);
  assert.equal(ctx.operationalTests().length, 0, 'nhóm đã dừng phải biến khỏi danh sách nhập QC');
  assert.equal(ctx.operationalLevels(ctx.__getState().tests[0]).length, 0, 'mức thuộc nhóm đã dừng không còn vận hành');
  assert.equal(ctx.canEnterQcForLevel(ctx.__getState().tests[0], 1), false, 'không được ghi QC vào nhóm đã dừng');
  assert.equal(ctx.lotGroupInUse(ctx.__getState().lotGroups[0]), true, 'liên kết lô vẫn được giữ để xem lịch sử và kích hoạt lại');

  delete stopped.lotGroups[0].status;
  delete stopped.lotGroups[0].stoppedAt;
  ctx.__setState(stopped);
  assert.equal(ctx.operationalTests().length, 1, 'kích hoạt lại phải khôi phục luồng nhập QC');
}

console.log('Accepted lot points tests passed');
