import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { openDatabase } = require('../../app-dist/main/db/open-database.js');
const { applySchema } = require('../../app-dist/main/db/schema.js');
const { createConfigHandlers } = require('../../app-dist/main/ipc/config-handlers.js');
const { createSigmaHandlers } = require('../../app-dist/main/ipc/sigma-handlers.js');
const { uncertaintyBudget } = require('../../app-dist/main/domain/sigma-metrics.js');
const { resolveTea } = require('../../app-dist/main/domain/sigma-tea-core.js');
const actor = { userId: 'reviewer', username: 'reviewer', name: 'Reviewer', role: 'admin', clientId: 'test' };
const page = readFileSync(new URL('../renderer/pages/SigmaPage.tsx', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../renderer/lib/sigma-workflow.ts', import.meta.url), 'utf8');
function evaluate(source, context = {}) { return vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\r?$/gm, '').replace(/export /g, '')), context); }
const helpers = evaluate(workflow + '\n({parseEqaDraft, mdcRatios, governingSigmaLevel, sigmaMuExport})');
function section(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, start);
  return source.slice(a, b);
}
function scenario(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  const config = createConfigHandlers(db);
  const instrument = config.saveInstrument({ data: { name: 'Machine' } }, actor).data;
  const assay = config.saveTest({ data: { name: 'Sodium (Na)', instrumentId: instrument.id, unit: 'mmol/L' } }, actor).data;
  config.saveTestLevel({ testId: assay.id, data: { level: 1, mean: 140, sd: 2 } }, actor);
  // Mức 2 phải được khai thì `savePeriod()` mới nhận dòng mức 2 (cổng
  // `unknown-level`); các ca SG04/SG06 bên dưới đều dựng hai mức.
  config.saveTestLevel({ testId: assay.id, data: { level: 2, mean: 100, sd: 2 } }, actor);
  const sigma = createSigmaHandlers(db);
  const save = (levels, extra = {}) => sigma.savePeriod({ testId: assay.id, period: '2026-08', teaSource: 'clia', tea: 4 / 140 * 100, levels, ...extra }, actor);
  const insert = db.prepare('INSERT INTO qc_points(id,test_id,level,date,run_id,val,lot,qc_mean,qc_sd,voided) VALUES (?,?,?,?,?,?,?,?,?,0)');
  function seed(lot = 'L1', mean = 100, count = 30) {
    for (let i = 0; i < count; i++) insert.run(`${lot}-${i}`, assay.id, 1, `2026-08-${String(i % 28 + 1).padStart(2, '0')}`, String(i), mean + (i % 5 - 2) * 0.4, lot, mean, 2);
  }
  return { db, sigma, assay, save, seed };
}

test('SG01: actual Add period sends an enum for each TEa source, with per-level snapshot', async () => {
  const add = section(page, '  async function addPeriod(', '  async function commitBias(');
  const assignment = section(page, '  const configuredTeaSource =', '  const targetMeanForLevel');
  for (const teaSource of ['lab', 'eflm', 'clia', 'ricos']) {
    let payload;
    const fn = evaluate(assignment + add + '\naddPeriod', {
      teaSource, teaResolution: { criterion: 'Descriptive source, not an enum' }, periods: [], testId: 'A', currentTest: { current: 'A' },
      configuredTea: 4, operationalLevels: [1, 2], teaForLevel: level => 4 / level, targetMeanForLevel: level => 100 * level,
      savePeriod: async (...args) => { payload = args; return { ok: true, data: { id: 'A:2026-08' } }; }, setSelectedPeriodId() {},
    });
    assert.equal((await fn('2026-08')).ok, true);
    assert.equal(payload[3], teaSource);
    assert.equal(payload[4][1].tea, 2);
    assert.equal(payload[5], true);
  }
});

test('SG01b: sửa kỳ dùng nguồn TEa hiện hành nếu mã snapshot không hợp lệ', async () => {
  const teaSources = section(page, 'const TEA_SOURCES', 'function formatDpmo');
  const saveOwned = section(page, '  function saveOwnedPeriod(', '  function periodTeaText(');
  let payload;
  const save = evaluate(teaSources + saveOwned + '\nsaveOwnedPeriod', {
    configuredTeaSource: 'eflm',
    currentTest: { current: 'A' },
    useSigmaStore: { getState: () => ({ loading: false }) },
    savePeriod: async (...args) => { payload = args; return { ok: true }; },
  });
  await save({ testId: 'A', period: '2026-08', tea: 5, teaSource: 'nguon-cu' }, []);
  assert.equal(payload[3], 'eflm', 'mã nguồn cũ không được gửi qua ranh giới IPC');
  await save({ testId: 'A', period: '2026-08', tea: 5, teaSource: 'clia' }, []);
  assert.equal(payload[3], 'clia', 'snapshot nguồn hợp lệ phải được giữ nguyên');
});

test('SG01c: nạp CV theo lô xác nhận rà soát bằng hộp trung tâm và ghi audit', () => {
  const cohort = section(page, 'function CohortModal(', 'function MuModal(');
  assert.match(cohort, /confirmDialog\([\s\S]*title: 'Xác nhận rà soát IQC'[\s\S]*confirmLabel: 'Xác nhận và dùng dữ liệu'/);
  assert.match(cohort, /onSubmit\(selected, true\)/);
  assert.match(page, /onSubmit=\{async \(choices, cohortReviewed\) =>/);
  assert.match(page, /refreshCohort: true, cohortReviewed, cohortFingerprint/);
});

test('SG02/11: actual blur handlers preserve unchanged values; switching test rejects stale writes', async t => {
  const { save } = scenario(t);
  const period = save([{ level: 1, cv: 0.57535596, eqaRounds: [{ lab: 102.345, target: 100 }] }]).data;
  period.levels[0].cvSource = 'iqc-cohort';
  const payload = section(page, '  function levelPayload(', '  function periodTeaText(');
  const cv = section(page, '  async function commitCv(', '  /** Kỳ mới');
  const bias = section(page, '  async function commitBias(', '  if (!sigmaTests.length)');
  let calls = 0, confirmations = 0, accept = false;
  const currentTest = { current: period.testId };
  const methods = evaluate(payload + cv + bias + '\n({commitCv,commitBias})', {
    currentTest, useSigmaStore: { getState: () => ({ loading: false }) },
    editablePercent: value => value == null ? '' : value.toFixed(2),
    savePeriod: async () => { calls++; return { ok: true }; }, infoDialog: async () => {},
    confirmDialog: async () => { confirmations++; return accept; },
  });
  assert.equal(await methods.commitCv(period, 1, period.levels[0].cv.toFixed(2)), true);
  assert.equal(await methods.commitBias(period, 1, period.levels[0].biasEqa.toFixed(2)), true);
  assert.equal(calls, 0); assert.equal(confirmations, 0);
  assert.equal(await methods.commitBias(period, 1, '3'), false);
  assert.equal(calls, 0); assert.equal(confirmations, 1);
  accept = true; currentTest.current = 'B';
  assert.equal(await methods.commitCv(period, 1, '1'), false);
  assert.equal(calls, 0, 'old A payload must never write under B');
});

test('SG03: blank EQA is not zero; actual zero stays valid; partial objects cannot use stale bias', t => {
  const { save } = scenario(t);
  for (const row of [{ lab: '', target: '100' }, { lab: '1', target: '' }, { lab: '1', target: '0' }]) {
    const result = helpers.parseEqaDraft([row]);
    assert.equal(result.hasIncompleteRound, true); assert.equal(result.parsedRounds.length, 0);
  }
  const zero = helpers.parseEqaDraft([{ lab: '0', target: '100' }]);
  assert.equal(zero.hasIncompleteRound, false);
  assert.equal(save([{ level: 1, cv: 1, eqaRounds: zero.parsedRounds }]).data.levels[0].biasEqa, -100);
  assert.equal(save([{ level: 1, eqaRounds: [{ lab: '', target: 100, bias: 0 }] }]).ok, false);
  assert.equal(save([{ level: 1, eqaRounds: [{ lab: null, target: null, bias: -2 }] }]).ok, false);
});

test('SG03c: Bias RMS giữ thêm trung bình có dấu để truy xuất hướng lệch', t => {
  const { save } = scenario(t);
  const result = save([{ level: 1, eqaRounds: [{ lab: 97, target: 100 }, { lab: 95, target: 100 }] }]);
  assert.equal(result.data.levels[0].biasEqa, Math.sqrt(17));
  assert.equal(result.data.levels[0].biasMean, -4, 'RMS là độ lớn; trung bình có dấu phải còn để truy xuất');
  assert.match(page, /Bias RMS EQA\/EQC/);
  const printReport = readFileSync(new URL('../renderer/lib/sigma-print-report.ts', import.meta.url), 'utf8');
  assert.match(printReport, /Bias TB có dấu%/);
});

test('SG03b: lỗi nhập Bias dùng thông báo trung tâm, không chen vào phía trên bảng', () => {
  const modal = section(page, 'function BiasModal(', 'function CohortModal(');
  assert.match(modal, /infoDialog\('Nhập ít nhất 1 vòng EQA\/EQC\.', \{ title: 'Chưa thể áp dụng Bias%', type: 'warn' \}\)/);
  assert.match(modal, /infoDialog\(result\.error\?\.message \|\| 'Lỗi không xác định\.', \{ title: 'Không thể áp dụng Bias%', type: 'warn' \}\)/);
  assert.doesNotMatch(modal, /field-error|setErr\(/);
});

test('SG04: MDC uses exact same per-level TEa as Sigma', t => {
  const { save } = scenario(t);
  const levels = save([{ level: 1, tea: 2, cv: 1, biasEqa: 0.5 }, { level: 2, tea: 8, cv: 1, biasEqa: 0.5 }], { tea: 4 }).data.levels;
  for (const level of levels) {
    const { cvRatio, biasRatio } = helpers.mdcRatios(level);
    assert.equal((100 - biasRatio) / cvRatio, level.sigma.sigma);
  }
  assert.notEqual(helpers.mdcRatios(levels[0]).cvRatio, helpers.mdcRatios(levels[1]).cvRatio);
});

test('SG05: EFLM survives source switches; old shared value is never migrated as confirmed EFLM', t => {
  const { db, sigma, assay } = scenario(t);
  const input = { testId: assay.id, source: 'eflm', tea: 10, eflmRef: 'Certificate' };
  assert.equal(sigma.saveTeaConfig(input, actor).ok, true);
  sigma.saveTeaConfig({ testId: assay.id, source: 'clia', tea: 4 / 140 * 100 }, actor);
  const restored = sigma.saveTeaConfig({ testId: assay.id, source: 'eflm' }, actor).data;
  assert.equal(restored.eflm_tea, 10); assert.equal(restored.tea, 10);
  assert.equal(resolveTea(restored, [], [], 'eflm').value, 10);
  db.exec('ALTER TABLE tests DROP COLUMN eflm_tea');
  // CSDL cũ chưa có cột `eflm_tea` ghi phiên bản schema 1.
  db.prepare("UPDATE app_meta SET value='1' WHERE key='schemaVersion'").run();
  applySchema(db); applySchema(db);
  const restoredRow = db.prepare('SELECT * FROM tests WHERE id=?').get(assay.id);
  assert.equal(restoredRow.tea, 10); assert.equal(restoredRow.eflm_tea, null);
  assert.equal(resolveTea(restoredRow, [], [], 'eflm').value, null);
});

test('SG06: lot changes rescale saved criterion, independent of current catalog; untouched snapshots freeze', t => {
  const { db, sigma, assay, save, seed } = scenario(t);
  const initial = save([{ level: 1, tea: 4 / 140 * 100, targetMean: 140, cv: 1, biasEqa: 0 }]).data;
  seed('L1', 100);
  db.prepare("INSERT INTO tea_refs(id,name,clia_rule,clia_absolute,clia_absolute_unit) VALUES ('override','Sodium (Na)','absolute',8,'mmol/L')").run();
  const changed = save([{ ...initial.levels[0], cvSource: 'iqc-cohort', sourceLot: 'L1', refreshCohort: true }]);
  assert.equal(changed.ok, true, changed.error?.message);
  assert.equal(changed.data.levels[0].targetMean, 100);
  assert.equal(changed.data.levels[0].tea, 4, 'original ±4 criterion, not new ±8 or old TEa%');
  const cv = changed.data.levels[0].cv;
  db.prepare('UPDATE qc_points SET val=val+0.2 WHERE id=?').run('L1-0');
  const biasEdit = save([{ ...changed.data.levels[0], biasEqa: 1 }]);
  assert.equal(biasEdit.data.levels[0].cv, cv, 'editing bias does not refresh CV');
  assert.equal(biasEdit.data.levels[0].cohortStale, true);
  assert.equal(sigma.renamePeriod({ id: initial.id, period: '2026-07' }, actor).error.code, 'cohort-period-fixed');
  db.prepare('UPDATE test_levels SET mean=200 WHERE test_id=?').run(assay.id);
  assert.equal(sigma.listPeriods(assay.id)[0].levels[0].tea, 4);
});

test('SG07: enough points alone cannot unlock QC; review has attribution and invalidates when IQC changes', t => {
  const { db, sigma, assay, save, seed } = scenario(t); seed();
  let result = save([{ level: 1, cvSource: 'iqc-cohort', sourceLot: 'L1', biasEqa: 0 }]).data;
  assert.equal(result.levels[0].cohortStatus, 'eligible');
  assert.equal(result.levels[0].cohortReviewed, false); assert.equal(result.levels[0].qualityDesign, null);
  const cohort = sigma.listCohorts(assay.id, '2026-08', [1])[0];
  assert.equal(save([{ ...result.levels[0], refreshCohort: true, cohortReviewed: true, cohortFingerprint: 'stale' }]).error.code, 'cohort-changed');
  result = save([{ ...result.levels[0], refreshCohort: true, cohortReviewed: true, cohortFingerprint: cohort.fingerprint }]).data;
  assert.equal(result.levels[0].cohortReviewed, true);
  assert.equal(result.levels[0].cohortReviewBy, actor.name);
  assert.ok(result.levels[0].qualityDesign);
  db.prepare('UPDATE qc_points SET val=val+0.1 WHERE id=?').run('L1-1');
  const stale = sigma.listPeriods(assay.id)[0].levels[0];
  assert.equal(stale.cohortStale, true); assert.equal(stale.cohortReviewed, false); assert.equal(stale.qualityDesign, null);
  assert.ok(db.prepare("SELECT detail FROM activity WHERE type='Sửa kỳ Six Sigma'").all().some(row => row.detail.includes('rà soát')));
});

test('SG06: missing historical criterion is not guessed from the current catalog', t => {
  const { db, save, seed } = scenario(t);
  const period = save([{ level: 1, tea: 3, targetMean: 140, cv: 1, biasEqa: 0 }]).data;
  seed('OLD', 100);
  const result = save([{ ...period.levels[0], cvSource: 'iqc-cohort', sourceLot: 'OLD', refreshCohort: true }]);
  assert.equal(result.ok, false); assert.equal(result.error.code, 'cohort-tea-unresolved');
  const unchanged = JSON.parse(db.prepare('SELECT lv_json FROM sigma_data WHERE id=?').get(period.id).lv_json)[0];
  assert.equal(unchanged.tea, 3); assert.equal(unchanged.targetMean, 140);
});

test('SG07: missing targets cannot be approved by client, shifted series needs explicit human review', t => {
  const { db, sigma, assay, seed } = scenario(t); seed();
  db.prepare('UPDATE qc_points SET qc_sd=NULL WHERE id=?').run('L1-0');
  const c = sigma.listCohorts(assay.id, '2026-08', [1])[0];
  assert.equal(c.status, 'unstable');
  assert.ok(c.issues.some(issue => issue.includes('Thiếu snapshot')));
});

test('SG08: common design requires ALL levels; choose worst only after every level passes', () => {
  const ready = { cvSource: 'iqc-cohort', cohortStatus: 'eligible', cohortReviewed: true, qualityDesign: {} };
  const levels = [{ ...ready, level: 1, sigma: { sigma: 6 } }, { ...ready, level: 2, sigma: { sigma: 2 }, cohortStatus: 'out-of-control' }];
  assert.equal(helpers.governingSigmaLevel({ levels }), undefined);
  levels[1].cohortStatus = 'eligible';
  assert.equal(helpers.governingSigmaLevel({ levels }).level, 2);
  levels[1].cohortReviewed = false;
  assert.equal(helpers.governingSigmaLevel({ levels }), undefined);
});

test('SG09: incomplete MU never reports acceptance or numeric final U in export', () => {
  const mu = uncertaintyBudget({ cv: 1, bias: 0, tea: 10, target: 100 });
  assert.equal(mu.complete, false); assert.equal(mu.withinTea, null); assert.equal(mu.teaRatio, null);
  const cells = helpers.sigmaMuExport({ mu, cvSource: 'manual' });
  assert.equal(cells[0], ''); assert.equal(cells[1], ''); assert.equal(cells[2], '');
  assert.match(cells[3], /u\(Cref\).*u\(cal\)/);
  const full = uncertaintyBudget({ cv: 1, bias: 0, uCref: 0, uCal: 0, tea: 10 });
  assert.equal(full.complete, true); assert.equal(full.withinTea, true);
  assert.equal(helpers.sigmaMuExport({ mu: full, cvSource: 'manual' })[0], 2);
});

test('SG10: every Sigma write rolls back when audit fails, including rename', t => {
  const { db, sigma, assay, save } = scenario(t);
  const existing = save([{ level: 1, cv: 1, biasEqa: 0 }]).data;
  const before = JSON.stringify(db.prepare('SELECT * FROM sigma_data').all());
  const configBefore = JSON.stringify(db.prepare('SELECT * FROM tests WHERE id=?').get(assay.id));
  db.exec("CREATE TRIGGER review_fail_audit BEFORE INSERT ON activity BEGIN SELECT RAISE(ABORT,'review-audit-fail'); END");
  const writes = [
    () => save([{ level: 1, cv: 2 }]),
    () => save([{ level: 1, cv: 2 }], { period: '2026-07' }),
    () => sigma.renamePeriod({ id: existing.id, period: '2026-06' }, actor),
    () => sigma.removePeriod({ data: { id: existing.id } }, actor),
    () => sigma.saveTeaConfig({ testId: assay.id, source: 'eflm', tea: 3 }, actor),
  ];
  for (const write of writes) {
    assert.throws(write, /review-audit-fail/);
    assert.equal(JSON.stringify(db.prepare('SELECT * FROM sigma_data').all()), before);
    assert.equal(JSON.stringify(db.prepare('SELECT * FROM tests WHERE id=?').get(assay.id)), configBefore);
  }
});

test('SG11: delayed and failed requests cannot replace newest test, including refresh after an old write', async () => {
  const source = readFileSync(new URL('../renderer/store/sigma-store.ts', import.meta.url), 'utf8');
  let state, finishSave;
  const pending = {};
  const create = init => state = init(patch => { state = { ...state, ...patch }; }, () => state);
  evaluate(source, { create, window: { qcApi: {
    listSigmaPeriods: id => new Promise((resolve, reject) => { pending[id] = { resolve, reject }; }),
    saveSigmaPeriod: () => new Promise(resolve => { finishSave = resolve; }),
  } } });
  const a = state.loadPeriods('A'), b = state.loadPeriods('B');
  pending.B.resolve([{ testId: 'B' }]); await b;
  pending.A.resolve([{ testId: 'A' }]); await a;
  assert.equal(state.periods[0].testId, 'B');
  const write = state.savePeriod('A', '2026-08', 1, 'clia', []);
  finishSave({ ok: true }); await write;
  assert.equal(state.testId, 'B'); assert.equal(state.periods[0].testId, 'B');
  const failure = state.loadPeriods('C'); pending.C.reject(new Error('offline')); await failure;
  assert.equal(state.periods.length, 0); assert.ok(state.error);
  await state.loadPeriods(''); assert.equal(state.testId, ''); assert.equal(state.loading, false);
});

test('SG12 and supplementary: units, draft preview, no clipped trend, and shared export are wired', () => {
  assert.match(page, /u = U\/k/); assert.match(page, /chỉ chia 2 khi k = 2/);
  assert.match(page, /100 × u \/ \|giá trị tham chiếu\|/);
  assert.match(page, /const preview = uncertaintyBudget\(\{ cv: level.cv, bias: level.biasEqa, uCref, uCal, includeBias/);
  const printReport = readFileSync(new URL('../renderer/lib/sigma-print-report.ts', import.meta.url), 'utf8');
  assert.match(page, /buildSigmaPeriodPrintHtml\(\{/);
  assert.match(printReport, /mu\?\.complete \? number\(mu\.U, 4\) : '—'/);
  assert.match(page, /saveOwnedPeriod\(biasModal.period/); assert.match(page, /saveOwnedPeriod\(muModal.period/);
  const charts = readFileSync(new URL('../renderer/components/SigmaCharts.tsx', import.meta.url), 'utf8');
  assert.match(charts, /mdcRatios\(levelData\)/);
  assert.doesNotMatch(charts, /Math\.max\(0, Math\.min\(8/);
  assert.match(charts, /<title>.*point.sigma.toFixed/);
});

test('new writes freeze resolved TEa; uppercase source behaves like lowercase', t => {
  const { db, sigma, assay, save } = scenario(t);
  const saved = save([{ level: 1, cv: 1, biasEqa: 0 }], { teaSource: 'CLIA' });
  assert.equal(saved.data.teaSource, 'clia');
  assert.equal(saved.data.levels[0].tea, 4 / 140 * 100);
  db.prepare('UPDATE test_levels SET mean=200 WHERE test_id=?').run(assay.id);
  assert.equal(sigma.listPeriods(assay.id)[0].levels[0].tea, 4 / 140 * 100);
});

test('actual React SVG: MDC levels have distinct correct positions; trend retains negative and >8 Sigma', async () => {
  const { transformWithOxc } = await import('vite');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const source = readFileSync(new URL('../renderer/components/SigmaCharts.tsx', import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const transformed = await transformWithOxc(source, 'SigmaCharts.tsx', { jsx: { runtime: 'classic' } });
  const components = vm.runInNewContext(transformed.code.replace(/export /g, '') + '\n({SigmaMdcChart,SigmaTrendChart})', { React, useMemo: React.useMemo, useState: React.useState, mdcRatios: helpers.mdcRatios });
  const levels = [2, 8].map((tea, index) => ({ level: index + 1, tea, cv: 1, biasEqa: 0.5, sigma: { tea, sigma: tea - 0.5 } }));
  const mdc = renderToStaticMarkup(React.createElement(components.SigmaMdcChart, { periods: [{ id: 'p', period: '2026-08', tea: 4, levels }] }));
  const x = [...mdc.matchAll(/<circle[^>]*cx="([^"]+)"/g)].map(match => Number(match[1]));
  assert.equal(x.length, 2); assert.equal(x[0], 827.5); assert.equal(x[1], 240.625);
  const periods = [-2, 0, 8, 20].map((sigma, i) => ({ id: `${i}`, period: `2026-0${i + 1}`, levels: [{ level: 1, sigma: { sigma } }] }));
  const trend = renderToStaticMarkup(React.createElement(components.SigmaTrendChart, { periods }));
  const y = [...trend.matchAll(/<circle[^>]*cy="([^"]+)"/g)].map(match => Number(match[1]));
  assert.equal(new Set(y).size, 4); assert.match(trend, /Sigma -2\.00/); assert.match(trend, /Sigma 20\.00/);
});

test('actual MU modal renders the edited draft, not stored MU, and marks incomplete budget', async () => {
  const { transformWithOxc } = await import('vite');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const transformed = await transformWithOxc(page.slice(page.indexOf('function MuModal(')), 'MuModal.tsx', { jsx: { runtime: 'classic' } });
  function render(drafts) {
    const MuModal = vm.runInNewContext(transformed.code + '\nMuModal', {
      React, uncertaintyBudget, useState: () => [drafts.shift(), () => {}],
      Modal: ({ children }) => React.createElement('section', null, children),
    });
    return renderToStaticMarkup(React.createElement(MuModal, { level: { cv: 1, biasEqa: 0, tea: 10, mu: { U: 2 } } }));
  }
  assert.match(render(['0', '5', false, null]), /10\.198/);
  assert.match(render(['', '', true, null]), /Tạm tính chưa đầy đủ/);
  assert.match(render(['', '', true, null]), /không dùng để kết luận đạt TEa/);
});


