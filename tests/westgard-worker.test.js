const assert = require('node:assert/strict');
const QCCore = require('../assets/core.js');
const { computeWestgardJob, ruleAction, verdictLevel, ruleScope, ruleOnIn } = require('../assets/workers/westgard-worker.js');
const { loadSandbox, run } = require('./helpers/sandbox');

const levels = [
  {
    level: 1, mean: 100, sd: 10,
    points: [
      { id: 'p1', level: 1, date: '2026-07-01', runId: '2026-07-01-1', val: 131, qcMean: 100, qcSd: 10 },
      { id: 'p2', level: 1, date: '2026-07-02', runId: '2026-07-02-1', val: 104, qcMean: 100, qcSd: 10 },
    ],
  },
  {
    level: 2, mean: 200, sd: 20,
    points: [
      { id: 'p3', level: 2, date: '2026-07-01', runId: '2026-07-01-1', val: 138, qcMean: 200, qcSd: 20 },
      { id: 'p4', level: 2, date: '2026-07-02', runId: '2026-07-02-1', val: 208, qcMean: 200, qcSd: 20 },
    ],
  },
];
const job = {
  type: 'compute', generation: 7, testId: 'T1', levels,
  globalRules: Object.fromEntries(QCCore.WG_RULES.map(rule => [rule, true])),
  ruleActions: { '1-2s': 'alert', '7T': 'alert', R4s: 'reject' },
};

const result = computeWestgardJob(job);
assert.equal(result.generation, 7);
assert.equal(result.testId, 'T1');

const isOn = rule => job.ruleActions[rule] !== 'inactive' && job.globalRules[rule] !== false;
const within = rule => isOn(rule) && ['within','both'].includes(ruleScope(job,rule));
const across = rule => isOn(rule) && ['across','both'].includes(ruleScope(job,rule));
const sets = levels.map(level => ({ level: level.level, mean: level.mean, sd: level.sd, pts: level.points }));
const singles = sets.map(set => QCCore.westgardByPoint(set.pts, set.mean, set.sd, within));
const cross = QCCore.westgardMultiByPoint(sets, across);
result.levels.forEach((levelResult, levelIndex) => {
  levelResult.points.forEach((row, pointIndex) => {
    const point = sets[levelIndex].pts[pointIndex];
    const singleRules = singles[levelIndex].F[pointIndex].rules;
    const expectedRules = [...new Set([...singleRules, ...(cross.get(point) || [])])];
    assert.deepEqual(row.singleRules, singleRules);
    assert.deepEqual(row.rules, expectedRules);
    assert.equal(row.level, verdictLevel(job, expectedRules));
  });
});
assert.ok(result.levels[0].points[0].rules.includes('R4s'), 'cross-level R4s must survive worker serialization');

const compactJob = {
  ...job,
  levels: levels.map(level => ({ level: level.level, mean: level.mean, sd: level.sd, lot: `L${level.level}` })),
  points: [...levels[1].points.map(point => ({ ...point, lot: 'L2' })), ...levels[0].points.map(point => ({ ...point, lot: 'L1' }))].reverse(),
};
const compactResult = computeWestgardJob(compactJob);
assert.deepEqual(compactResult.levels[0].points.map(point => point.id), ['p1', 'p2'], 'worker sorts compact payload off the main thread');
assert.deepEqual(compactResult.levels.map(level => level.points.map(point => point.rules)), result.levels.map(level => level.points.map(point => point.rules)));

{
  const points = Array.from({ length: 6 }, (_, i) => ({
    id: `six-${i + 1}`, level: 1, date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    runId: `2026-06-${String(i + 1).padStart(2, '0')}-1`, val: 101, qcMean: 100, qcSd: 10,
  }));
  const globalRules = Object.fromEntries(QCCore.WG_RULES.map(rule => [rule, rule === '6x']));
  const warningJob = { type: 'compute', generation: 8, testId: 'T6', levels: [{ level: 1, mean: 100, sd: 10, points }], globalRules, ruleActions: {} };
  const warning = computeWestgardJob(warningJob);
  assert.ok(warning.levels[0].points.slice(0,-1).every(point => point.supportRules.includes('6x')));
  assert.ok(warning.levels[0].points.slice(0,-1).every(point => point.level === 'ok'), 'historical evidence is not warned retroactively');
  assert.ok(warning.levels[0].points[5].rules.includes('6x'));
  assert.equal(warning.levels[0].points[5].level,'warn','6x defaults to warning in worker path');
  const rejected = computeWestgardJob({ ...warningJob, ruleActions: { '6x': 'reject' } });
  assert.ok(rejected.levels[0].points.slice(0,-1).every(point => point.level === 'ok'));
  assert.equal(rejected.levels[0].points[5].level,'rej','per-test SOP can override 6x to reject');
}

const state = {
  lab: {}, machines: [], instruments: [{ id: 'i1', name: 'Analyzer', active: true }], assayGroups: [],
  qcPanels: [{ id: 'panel', name: 'Panel', instrumentId: 'i1', testIds: ['T1'], active: true }],
  lotTransitions: [], lotGroups: [{ id: 'group', name: 'Group', lotIds: ['lot1', 'lot2'], active: true }],
  qcLots: [
    { id: 'lot1', groupId: 'group', lotNo: 'L1', level: 1, active: true },
    { id: 'lot2', groupId: 'group', lotNo: 'L2', level: 2, active: true },
  ],
  tests: [{
    id: 'T1', name: 'Glucose', active: true, instrumentId: 'i1', ruleActions: job.ruleActions,
    levels: [
      { level: 1, qcLotId: 'lot1', lot: 'L1', mean: 100, sd: 10 },
      { level: 2, qcLotId: 'lot2', lot: 'L2', mean: 200, sd: 20 },
    ],
  }],
  data: { T1: [...levels[0].points.map(p => ({ ...p, lot: 'L1' })), ...levels[1].points.map(p => ({ ...p, lot: 'L2' }))] },
  actions: [], activity: [], users: [], reagentTests: [], reagentOperators: [], reagentSampleTypes: [],
  sigmaData: {}, periodLocks: [], teaRefs: [], westgardRules: job.globalRules, configMigrationVersion: 1,
};

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
ctx.__state = state;
ctx.__message = result;
assert.equal(run(ctx, 'typeof westgardWorkerJobBuilder'), 'function', 'payload Worker phải được tạo qua artifact TypeScript');
assert.equal(run(ctx, 'typeof westgardWorkerRevisionService'), 'object', 'revision Worker phải được quản lý qua artifact TypeScript');
assert.equal(run(ctx, 'typeof westgardWorkerHydrate'), 'function', 'hydrate Worker phải được xử lý qua artifact TypeScript');
assert.equal(run(ctx, 'typeof westgardWorkerPrewarmPlanner'), 'object', 'prewarm Worker phải được lập kế hoạch qua artifact TypeScript');
const hydrated = run(ctx, `state=__state;clearDerived();wgWorkerGeneration=7;hydrateWestgardWorkerResult(__message)`);
assert.equal(hydrated, true);
assert.equal(run(ctx, `activeWestgard(state.tests[0]).byPoint.get('p1').rules.includes('R4s')`), true);

ctx.__stale = { ...result, generation: 6 };
assert.equal(run(ctx, `hydrateWestgardWorkerResult(__stale)`), false, 'stale worker generations must be ignored');

const scopedInvalidation = run(ctx, `(()=>{
  let terminated=0;wgWorker={terminate(){terminated++;}};
  const generation=wgWorkerGeneration;
  invalidateWestgardWorker('T1');
  const afterTest={generation:wgWorkerGeneration,revision:westgardWorkerRevision('T1'),terminated,workerAlive:!!wgWorker};
  invalidateWestgardWorker();
  return{generation,afterTest,afterGlobal:{generation:wgWorkerGeneration,terminated,workerAlive:!!wgWorker}};
})()`);
assert.equal(scopedInvalidation.afterTest.generation, scopedInvalidation.generation, 'test-scoped invalidation preserves the global worker generation');
assert.equal(scopedInvalidation.afterTest.revision, 1);
assert.equal(scopedInvalidation.afterTest.terminated, 0, 'changing one test keeps the worker alive');
assert.equal(scopedInvalidation.afterTest.workerAlive, true);
assert.equal(scopedInvalidation.afterGlobal.generation, scopedInvalidation.generation + 1);
assert.equal(scopedInvalidation.afterGlobal.terminated, 1, 'global invalidation still terminates stale work');
assert.equal(scopedInvalidation.afterGlobal.workerAlive, false);

/* ===== Ngữ nghĩa luật: luồng chính và worker phải khớp TUYỆT ĐỐI =====
   Worker quyết định nhận/loại cho mọi xét nghiệm từ WG_WORKER_POINT_THRESHOLD
   điểm trở lên, nên một bảng luật lệch sẽ cho kết luận khác nhau CHỈ vì bộ dữ
   liệu to hay nhỏ — đúng loại sai lệch im lặng nhất. Vì thế bảng hành động và
   phạm vi sống ở core.js, không chép hai bản. Kiểm chứng 2026-08-01: hồi còn
   hai bản, sửa riêng bảng trong worker vẫn qua sạch cả 58 test. */
{
  const overrideCases = [
    {},
    { ruleActions: { 'R4s': 'inactive', '1-2s': 'reject' } },
    { ruleScopes: { 'R4s': 'within', '10x': 'both', '1-3s': 'across' } },
    { ruleActions: { '6x': 'reject' }, ruleScopes: { '6x': 'within' } },
    { ruleActions: { 'R4s': 'khong-hop-le' }, ruleScopes: { '2-2s': 'protocol' } }, // giá trị rác phải cùng rơi về mặc định
  ];
  // Bật/tắt xen kẽ để cả nhánh 'inactive' lẫn nhánh alert/reject đều được đi qua.
  const globalRules = Object.fromEntries(QCCore.WG_RULES.map((rule, i) => [rule, i % 5 !== 0]));
  ctx.__parityState = { ...state, westgardRules: globalRules };
  let parityChecks = 0;
  for (const levelCount of [1, 2, 3, 4]) {
    overrideCases.forEach((overrides, caseIndex) => {
      // Không gắn qcLotId ⇒ operationalLevels() rỗng ⇒ testLevelCount() lùi về
      // t.levels.length, đúng số mức ta muốn thử mà không phải dựng cả lô/panel.
      const levels = Array.from({ length: levelCount }, (_, i) => ({ level: i + 1, mean: 100, sd: 10 }));
      ctx.__test = { id: `parity-${levelCount}-${caseIndex}`, name: 'Parity', levels, ...overrides };
      const mainSide = run(ctx, `state=__parityState;clearDerived();JSON.stringify(QCCore.WG_RULES.map(rule=>[
        testRuleAction(__test,rule),testRuleScope(__test,rule),
        testRuleOnIn(__test,rule,'within'),testRuleOnIn(__test,rule,'across'),
        ruleResultLevel(__test,[rule])]))`);
      const job = { levels, globalRules, ...overrides };
      const workerSide = JSON.stringify(QCCore.WG_RULES.map(rule => [
        ruleAction(job, rule), ruleScope(job, rule),
        ruleOnIn(job, rule, 'within'), ruleOnIn(job, rule, 'across'),
        verdictLevel(job, [rule])]));
      assert.equal(mainSide, workerSide, `luật lệch giữa luồng chính và worker: ${levelCount} mức, case ${caseIndex}`);
      parityChecks += QCCore.WG_RULES.length;
    });
  }
  assert.equal(parityChecks, QCCore.WG_RULES.length * 4 * overrideCases.length);
}

console.log('Westgard worker tests passed');
