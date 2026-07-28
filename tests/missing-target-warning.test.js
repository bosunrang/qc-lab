const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

// Mức đang vận hành nhưng thiếu Mean/SD hợp lệ: engine Westgard trả "ok" cho mọi
// điểm (guard sd<=0 trong core) nên dashboard/trang Westgard phải nhận diện được
// tình trạng này để cảnh báo thay vì hiển thị "Đạt" giả.
const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js']);
run(ctx, 'function __getState(){return state;} function __setState(s){state=s;clearDerived();}');

function baseState(levels) {
  const rules = Object.fromEntries(ctx.QCCore.WG_RULES.map(rule => [rule, ['1-2s','1-3s'].includes(rule)]));
  return {
    lab: {}, machines: [], instruments: [{ id: 'i1', name: 'Analyzer A', active: true }], assayGroups: [],
    qcPanels: [{ id: 'p1', name: 'Panel A', instrumentId: 'i1', testIds: ['T1'], active: true }],
    lotTransitions: [],
    lotGroups: [{ id: 'g1', name: 'L1/L2', lotIds: ['lot1','lot2'], active: true }],
    qcLots: [
      { id: 'lot1', groupId: 'g1', lotNo: 'L1', level: 1, exp: '2026-12-31', active: true },
      { id: 'lot2', groupId: 'g1', lotNo: 'L2', level: 2, exp: '2026-12-31', active: true },
    ],
    tests: [{ id: 'T1', name: 'Glucose', unit: 'mmol/L', instrumentId: 'i1', machine: 'Analyzer A', active: true, levels }],
    data: { T1: [
      { id: 'p1', date: '2026-07-01', runId: '2026-07-01-1', level: 1, lot: 'L1', val: 100, qcMean: 100, qcSd: 10 },
      { id: 'p2', date: '2026-07-01', runId: '2026-07-01-1', level: 2, lot: 'L2', val: 200, qcMean: 0, qcSd: 0 },
    ] },
    actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [],
    reagentSampleTypes: [], sigmaData: {}, periodLocks: [], westgardRules: rules, configMigrationVersion: 1,
  };
}

{
  assert.equal(ctx.levelTargetOk({ level: 1, mean: 100, sd: 10 }), true, 'Mean/SD hợp lệ');
  assert.equal(ctx.levelTargetOk({ level: 1, mean: 100, sd: 0 }), false, 'SD = 0 là thiếu target');
  assert.equal(ctx.levelTargetOk({ level: 1, mean: 100, sd: -5 }), false, 'SD âm là thiếu target');
  assert.equal(ctx.levelTargetOk({ level: 1, mean: 100 }), false, 'thiếu SD là thiếu target');
  assert.equal(ctx.levelTargetOk({ level: 1, sd: 10 }), false, 'thiếu Mean là thiếu target');
  assert.equal(ctx.levelTargetOk(null), false, 'không có cấu hình mức');
}

{
  ctx.__setState(baseState([
    { level: 1, qcLotId: 'lot1', lot: 'L1', mean: 100, sd: 10, exp: '2026-12-31' },
    { level: 2, qcLotId: 'lot2', lot: 'L2', mean: 0, sd: 0, exp: '2026-12-31' },
  ]));
  const t = ctx.__getState().tests[0];
  assert.equal(ctx.operationalLevels(t).length, 2, 'cả 2 mức đều đang vận hành');
  const missing = ctx.levelsMissingTarget(t);
  assert.equal(missing.length, 1, 'chỉ mức thiếu Mean/SD bị liệt kê');
  assert.equal(missing[0].level, 2, 'đúng mức 2 thiếu target');
}

{
  const stopped = baseState([{ level: 1, qcLotId: 'lot1', lot: 'L1', mean: 0, sd: 0, exp: '2026-12-31' }]);
  stopped.lotGroups[0].status = 'stopped';
  stopped.lotGroups[0].stoppedAt = '2026-07-16';
  ctx.__setState(stopped);
  assert.equal(ctx.levelsMissingTarget(ctx.__getState().tests[0]).length, 0, 'nhóm đã dừng không còn vận hành thì không cảnh báo thiếu target');
}

console.log('Missing-target warning tests passed');
