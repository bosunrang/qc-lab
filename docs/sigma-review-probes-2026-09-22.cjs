// HISTORICAL PRE-FIX PROBES: expected to stop/fail on the repaired code.
// Current regression verification: npm test (sigma-review-regressions.test.mjs).
// Read-only product review: synthetic in-memory databases only.
// Run after npm test: node docs/sigma-review-probes-2026-09-22.cjs
// Assertions document CURRENT DEFECTS / SAFETY GAPS, not desired regression expectations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const { openDatabase } = require(path.join(root, 'app-dist/main/db/open-database.js'));
const { createConfigHandlers } = require(path.join(root, 'app-dist/main/ipc/config-handlers.js'));
const { createSigmaHandlers } = require(path.join(root, 'app-dist/main/ipc/sigma-handlers.js'));
const { resolveTea } = require(path.join(root, 'app-dist/main/domain/sigma-tea-core.js'));
const { TEA_CATALOG_WITH_CLIA_ABSOLUTE: catalog } = require(path.join(root, 'app-dist/main/domain/tea-catalog.js'));
const { buildSigmaCohorts } = require(path.join(root, 'app-dist/main/domain/sigma-cohort.js'));
const { uncertaintyBudget, sigmaQualityDesign } = require(path.join(root, 'app-dist/main/domain/sigma-metrics.js'));
const page = fs.readFileSync(path.join(root, 'app/renderer/pages/SigmaPage.tsx'), 'utf8');
const charts = fs.readFileSync(path.join(root, 'app/renderer/components/SigmaCharts.tsx'), 'utf8');
const actor = { userId: 'review', username: 'review', name: 'Synthetic reviewer', role: 'admin', clientId: 'review' };
function fixture() {
  const db = openDatabase(':memory:');
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Review instrument' } }, actor).data;
  const test = config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: instrument.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: test.id, data: { level: 1, mean: 140, sd: 2 } }, actor);
  return { db, test, sigma: createSigmaHandlers(db) };
}
function segment(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `source markers: ${from}`);
  return source.slice(start, end);
}
function evaluate(ts, context = {}) { return vm.runInNewContext(stripTypeScriptTypes(ts), context); }
function log(id, evidence) { console.log(JSON.stringify({ id, ...evidence })); }
function points(n = 30) {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i}`, level: 1, lot: 'OLD', date: `2026-08-${String(i % 28 + 1).padStart(2, '0')}`, val: 100 + (i % 5 - 2) * 0.4, qc_mean: 100, qc_sd: 2 }));
}
async function main() {
  // Execute the actual renderer's non-JSX payload functions with real IPC handlers.
  const payloadFns = segment(page, '  function levelPayload(', '  function periodTeaText(');
  const cvFn = segment(page, '  async function commitCv(', '  /** Kỳ mới');
  const biasFn = segment(page, '  async function commitBias(', '  async function setTracking(');
  const { db, test, sigma } = fixture();
  const save = (period, levels, extra = {}) => sigma.savePeriod({ testId: test.id, period, tea: 4, teaSource: 'clia', levels, ...extra }, actor);
  const savePeriod = (testId, period, tea, teaSource, levels) => sigma.savePeriod({ testId, period, tea, teaSource, levels }, actor);
  const context = { testId: test.id, savePeriod, infoDialog: async () => {} };
  const renderer = evaluate(payloadFns + cvFn + biasFn + '\n({levelPayload, commitCv, commitBias})', context);
  const resolved = resolveTea(test, [], catalog, 'clia', 140);
  assert.ok(resolved.value > 0);
  const badSource = save('2026-08', [{ level: 1 }], { teaSource: resolved.criterion });
  assert.equal(badSource.error.code, 'invalid-tea-source');
  log('SG01', { criterionSentByAddPeriod: resolved.criterion, error: badSource.error.code });

  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  points().forEach((p) => insert.run(p.id, test.id, p.level, p.date, p.id, p.val, p.lot, p.qc_mean, p.qc_sd));
  let saved = save('2026-08', [{ level: 1, cvSource: 'iqc-cohort', sourceLot: 'OLD', tea: 4, targetMean: 100, eqaRounds: [{ lab: 102.345, target: 100 }] }]);
  assert.ok(saved.ok);
  const before = saved.data.levels[0];
  await renderer.commitCv(saved.data, 1, before.cv.toFixed(2));
  const afterCv = sigma.listPeriods(test.id)[0];
  assert.equal(afterCv.levels[0].cvSource, 'manual');
  await renderer.commitBias(afterCv, 1, afterCv.levels[0].biasEqa.toFixed(2));
  const afterBias = sigma.listPeriods(test.id)[0].levels[0];
  assert.equal(afterBias.eqaRounds.length, 0);
  log('SG02', { before: { cv: before.cv, source: before.cvSource, rounds: before.eqaRounds.length, bias: before.biasEqa }, after: { cv: afterBias.cv, source: afterBias.cvSource, rounds: afterBias.eqaRounds.length, bias: afterBias.biasEqa } });

  const parser = segment(page, '  const draftRounds =', '  async function submit()');
  const parsed = evaluate(parser + '\n({parsedRounds, hasIncompleteRound, biases})', { rounds: [{ lab: '', target: '100' }], rmsOf: (xs) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length) });
  assert.equal(parsed.hasIncompleteRound, false);
  assert.equal(parsed.biases[0], -100);
  const eqaSaved = save('2026-07', [{ level: 1, cv: 1, eqaRounds: parsed.parsedRounds }]);
  assert.ok(eqaSaved.ok);
  log('SG03', { input: { lab: '', target: '100' }, accepted: eqaSaved.ok, bias: eqaSaved.data.levels[0].biasEqa });

  const perLevel = save('2026-06', [{ level: 1, tea: 2, cv: 1, biasEqa: 0.5 }, { level: 2, tea: 8, cv: 1, biasEqa: 0.5 }]).data;
  const teaExpr = charts.match(/const tea = (Number\(period\.tea[^;]+);/)[1];
  const mdc = perLevel.levels.map(levelData => {
    const tea = vm.runInNewContext(teaExpr, { period: perLevel, levelData });
    return { level: levelData.level, correctSigma: levelData.sigma.sigma, mdcTea: tea, mdcImpliedSigma: (tea - Math.abs(levelData.biasEqa)) / levelData.cv };
  });
  assert.equal(mdc[0].mdcImpliedSigma, mdc[1].mdcImpliedSigma);
  log('SG04', { levels: mdc });

  sigma.saveTeaConfig({ testId: test.id, source: 'eflm', tea: 10, eflmRef: 'Synthetic EFLM reference', eflmAnalyte: 'Sodium' }, actor);
  sigma.saveTeaConfig({ testId: test.id, source: 'clia', tea: resolved.value }, actor);
  const returnedEflm = sigma.saveTeaConfig({ testId: test.id, source: 'eflm' }, actor).data;
  assert.equal(returnedEflm.tea, resolved.value);
  log('SG05', { originalEflm: 10, afterEflmCliaEflm: returnedEflm.tea, source: returnedEflm.tea_source, referenceStillPresent: returnedEflm.eflm_ref });

  const cohort = sigma.listCohorts(test.id, '2026-08', [1])[0];
  const changedLot = save('2026-08', [{ level: 1, tea: resolved.value, targetMean: cohort.targetMean, cvSource: 'iqc-cohort', sourceLot: cohort.lot, biasEqa: 0 }]).data.levels[0];
  assert.equal(changedLot.targetMean, 100);
  assert.equal(changedLot.tea, resolved.value);
  log('SG06', { newTarget: changedLot.targetMean, retainedTea: changedLot.tea, correctTeaForSelectedLot: 4, sigma: changedLot.sigma.sigma, correctSigma: 4 / changedLot.cv });

  const shifted = points().map((p, i) => ({ ...p, val: 102.5 + (i % 2) * 0.1 }));
  const shiftedCohort = buildSigmaCohorts(shifted, '2026-08', [1], '2026-09-22')[0];
  const noTargets = buildSigmaCohorts(points().map(p => ({ ...p, qc_mean: null, qc_sd: null })), '2026-08', [1], '2026-09-22')[0];
  assert.equal(shiftedCohort.status, 'eligible');
  assert.equal(noTargets.status, 'eligible');
  log('SG07', { thirtyPointsAbovePlus1SD: shiftedCohort.status, noMeanSdSnapshots: noTargets.status });

  const governance = segment(page, '  const governingLevel =', '  function levelPayload(');
  const selected = evaluate(governance + '\ngoverningLevel', { displayPeriod: { levels: [
    { level: 1, cvSource: 'iqc-cohort', cohortStatus: 'eligible', sigma: { sigma: 6 }, qualityDesign: sigmaQualityDesign(6, 2) },
    { level: 2, cvSource: 'iqc-cohort', cohortStatus: 'out-of-control', sigma: { sigma: 2 }, qualityDesign: sigmaQualityDesign(2, 2) },
  ] } });
  assert.equal(selected.level, 1);
  log('SG08', { worstLevelSigma: 2, governingSigma: selected.sigma.sigma, proposedRules: selected.qualityDesign.rules });

  const mu = uncertaintyBudget({ cv: 1, bias: 0, tea: 10, target: 100 });
  const exportFn = segment(page, '  const exportRows =', '  async function exportPeriod(');
  const exported = evaluate(exportFn + '\n({rows:exportRows(periods),headers:EXPORT_HEADERS})', { periods: [{ period: '2026-08', tea: 10, levels: [{ level: 1, cv: 1, biasEqa: 0, targetMean: 100, mu }] }], vnPeriod: x => x, formatDpmo: x => x });
  assert.equal(mu.complete, false);
  assert.equal(mu.withinTea, true);
  log('SG09', { budget: { U: mu.U, complete: mu.complete, missing: mu.missing, withinTea: mu.withinTea }, export: exported });

  db.exec("CREATE TRIGGER sigma_review_audit_failure BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END");
  assert.throws(() => save('2026-05', [{ level: 1, cv: 1, biasEqa: 0 }]), /synthetic audit failure/);
  const persistedDespiteError = !!db.prepare('SELECT id FROM sigma_data WHERE period=?').get('2026-05');
  assert.equal(persistedDespiteError, true);
  log('SG10', { requestThrew: true, persistedDespiteError });
  db.close();

  let state;
  const pending = {};
  const create = init => { state = init(patch => { state = { ...state, ...patch }; }, () => state); return state; };
  const storeSource = fs.readFileSync(path.join(root, 'app/renderer/store/sigma-store.ts'), 'utf8').replace(/^import .*;\r?$/gm, '').replace(/export /g, '');
  evaluate(storeSource, { create, window: { qcApi: { listSigmaPeriods: id => new Promise(resolve => { pending[id] = resolve; }) } } });
  const a = state.loadPeriods('A'), b = state.loadPeriods('B');
  pending.B([{ testId: 'B', period: '2026-08' }]); await b;
  pending.A([{ testId: 'A', period: '2026-08' }]); await a;
  assert.equal(state.periods[0].testId, 'A');
  const other = fixture();
  other.sigma.savePeriod({ testId: other.test.id, period: '2026-08', tea: 10, levels: [{ level: 1, cv: 7, biasEqa: 0 }] }, actor);
  const wrongTestRenderer = evaluate(payloadFns + biasFn + '\n({commitBias})', {
    testId: other.test.id,
    savePeriod: (testId, period, tea, teaSource, levels) => other.sigma.savePeriod({ testId, period, tea, teaSource, levels }, actor),
    infoDialog: async () => {},
  });
  await wrongTestRenderer.commitBias({ id: 'A:2026-08', testId: 'A', period: '2026-08', tea: 4, teaSource: 'clia', levels: [afterBias] }, 1, '5');
  const overwritten = other.sigma.listPeriods(other.test.id)[0].levels[0];
  assert.equal(overwritten.cv, afterBias.cv);
  log('SG11', { latestRequestedTest: 'B', finalDisplayedTest: state.periods[0].testId, originalBCv: 7, bCvAfterEditingStaleA: overwritten.cv });
  other.db.close();
  console.log('11 review scenarios confirmed. Product source and real database unchanged.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
