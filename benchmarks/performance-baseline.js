const { performance } = require('node:perf_hooks');
const { loadSandbox, run } = require('../tests/helpers/sandbox');

const DEFAULT_SCENARIOS = [
  { name: 'small', tests: 10, levels: 2, days: 365 },
  { name: 'deployment', tests: 50, levels: 3, days: 730 },
];
const TEN_YEAR_SCENARIO = { name: 'ten-years', tests: 50, levels: 3, days: 3650 };

function parseScenarios(argv) {
  if (argv.includes('--ten-years')) return [TEN_YEAR_SCENARIO];
  if (argv.includes('--deployment-only')) return [DEFAULT_SCENARIOS[1]];
  if (!argv.includes('--quick')) return DEFAULT_SCENARIOS;
  return [{ name: 'quick', tests: 5, levels: 2, days: 90 }];
}

function isoDate(dayIndex) {
  const d = new Date(Date.UTC(2024, 0, 1 + dayIndex));
  return d.toISOString().slice(0, 10);
}

function makeState({ tests: testCount, levels: levelCount, days }) {
  const tests = [];
  const data = {};
  const instruments = [{ id: 'instrument-1', name: 'Analyzer 1', active: true }];
  const qcLots = [];
  const lotGroups = [];
  const testIds = [];

  for (let ti = 0; ti < testCount; ti++) {
    const testId = `test-${ti + 1}`;
    const levels = [];
    const points = [];
    testIds.push(testId);

    for (let li = 0; li < levelCount; li++) {
      const level = li + 1;
      const lotId = `lot-${ti + 1}-${level}`;
      const lotNo = `L${ti + 1}-${level}`;
      const mean = 80 + ti * 0.7 + level * 20;
      const sd = Math.max(1, mean * 0.025);

      qcLots.push({ id: lotId, groupId: `group-${ti + 1}`, lotNo, level, active: true });
      levels.push({ level, qcLotId: lotId, lot: lotNo, mean, sd, mfgMean: mean, mfgSd: sd, applied: 'mfg' });

      for (let day = 0; day < days; day++) {
        const date = isoDate(day);
        const wave = Math.sin((day + ti * 3 + li * 7) / 11);
        const drift = day % 180 > 165 ? (day % 180 - 165) * 0.08 : 0;
        const val = mean + sd * (wave * 0.85 + drift);
        points.push({
          id: `point-${ti + 1}-${level}-${day + 1}`,
          date,
          runId: `${date}-1`,
          level,
          lot: lotNo,
          val,
          qcMean: mean,
          qcSd: sd,
        });
      }
    }

    lotGroups.push({
      id: `group-${ti + 1}`,
      name: `QC group ${ti + 1}`,
      lotIds: levels.map(level => level.qcLotId),
      active: true,
    });
    tests.push({
      id: testId,
      name: `Assay ${String(ti + 1).padStart(3, '0')}`,
      unit: 'unit',
      instrumentId: 'instrument-1',
      machine: 'Analyzer 1',
      active: true,
      levels,
      ruleActions: {},
      cusum: { on: true, k: 0.5, h: 4 },
    });
    data[testId] = points;
  }

  return {
    schemaVersion: 2,
    configMigrationVersion: 1,
    westgardProfileVersion: 2,
    lab: {},
    machines: ['Analyzer 1'],
    instruments,
    assayGroups: [],
    qcPanels: [{ id: 'panel-1', name: 'Deployment panel', instrumentId: 'instrument-1', testIds, active: true }],
    lotTransitions: [],
    lotGroups,
    qcLots,
    tests,
    data,
    actions: [],
    activity: [],
    users: [],
    reagentTests: [],
    reagentOperators: [],
    reagentSampleTypes: [],
    sigmaData: {},
    periodLocks: [],
    teaRefs: [],
    westgardRules: {},
  };
}

function measure(label, fn, repeats = 1) {
  const samples = [];
  let value;
  for (let i = 0; i < repeats; i++) {
    const start = performance.now();
    value = fn();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return { label, medianMs: Number(median.toFixed(2)), samplesMs: samples.map(v => Number(v.toFixed(2))), value };
}

function withoutValue(result) {
  const { value, ...summary } = result;
  return summary;
}

function runScenario(ctx, scenario) {
  const generated = measure('generate_state', () => makeState(scenario));
  const state = generated.value;
  const pointCount = Object.values(state.data).reduce((sum, rows) => sum + rows.length, 0);

  ctx.__benchmarkState = state;
  run(ctx, 'state=__benchmarkState;clearDerived();');

  const coldWestgard = measure('cold_westgard_all_tests', () => run(ctx, `(()=>{
    clearDerived();
    operationalTests().forEach(t=>activeWestgard(t));
  })()`));
  const coldAccepted = measure('cold_accepted_points_all_tests', () => run(ctx, `(()=>{
    clearDerived();
    operationalTests().forEach(t=>operationalLevels(t).forEach(l=>acceptedLotPoints(t,l.level)));
  })()`));
  const coldCusum = measure('cold_cusum_all_tests', () => run(ctx, `(()=>{
    clearDerived();
    operationalTests().forEach(t=>operationalLevels(t).forEach(l=>cusumSeries(t,l)));
  })()`));
  const workerPayload = measure('main_thread_worker_payload', () => run(ctx, `(()=>{
    clearDerived();
    return operationalTests().map(t=>westgardWorkerJob(t,0));
  })()`));

  const coldDomain = measure('cold_domain_all_tests', () => run(ctx, `(()=>{
    clearDerived();
    operationalTests().forEach(t=>{
      activeWestgard(t);
      operationalLevels(t).forEach(l=>{
        acceptedLotPoints(t,l.level);
        cusumSeries(t,l);
      });
    });
  })()`));
  const warmDomain = measure('warm_domain_all_tests', () => run(ctx, `(()=>{
    operationalTests().forEach(t=>{
      activeWestgard(t);
      operationalLevels(t).forEach(l=>{
        acceptedLotPoints(t,l.level);
        cusumSeries(t,l);
      });
    });
  })()`), 5);
  const unrelatedChange = measure('unrelated_change_then_domain_all_tests', () => run(ctx, `(()=>{
    invalidateDerivedForSave({clearDerived:false});
    operationalTests().forEach(t=>{
      activeWestgard(t);
      operationalLevels(t).forEach(l=>{
        acceptedLotPoints(t,l.level);
        cusumSeries(t,l);
      });
    });
  })()`), 5);
  const oneTestInvalidation = measure('one_test_recompute', () => run(ctx, `(()=>{
    invalidateDerivedForSave({testId:state.tests[0].id});
    operationalTests().forEach(t=>{
      activeWestgard(t);
      operationalLevels(t).forEach(l=>{acceptedLotPoints(t,l.level);cusumSeries(t,l);});
    });
  })()`), 5);
  const fullInvalidation = measure('full_recompute', () => run(ctx, `(()=>{
    clearDerived();
    operationalTests().forEach(t=>activeWestgard(t));
  })()`), 3);
  const stringify = measure('json_stringify_state', () => JSON.stringify(state), 5);
  const parse = measure('json_parse_state', () => JSON.parse(stringify.value), 3);

  return {
    scenario: scenario.name,
    shape: { tests: scenario.tests, levelsPerTest: scenario.levels, days: scenario.days, points: pointCount },
    approximateJsonMB: Number((Buffer.byteLength(stringify.value) / 1024 / 1024).toFixed(2)),
    measurements: [generated, workerPayload, coldWestgard, coldAccepted, coldCusum, coldDomain, warmDomain, unrelatedChange, oneTestInvalidation, fullInvalidation, stringify, parse].map(withoutValue),
  };
}

function main() {
  const scenarios = parseScenarios(process.argv.slice(2));
  const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/state-storage.js']);
  const startedAt = new Date().toISOString();
  const results = scenarios.map(scenario => runScenario(ctx, scenario));
  const output = {
    benchmark: 'QC Lab performance baseline',
    startedAt,
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    results,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (require.main === module) main();

module.exports = { makeState, measure, withoutValue, parseScenarios };
