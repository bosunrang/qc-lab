/**
 * Regression test: defaultAssayLevels() (assets/modules/manage-tests-actions.js) used to
 * seed a NEW test's levels from every distinct level found across ALL QC lots in the
 * whole system, not just this test's own panel/lot group. So a lab that had ANY level-3
 * QC lot anywhere would silently attach an empty, unrelated "level 3" entry to every
 * test created afterward — visible as a phantom row (Mean 0.00, no lot, "Chưa thuộc
 * nhóm") on Cấu hình chung > Lịch sử dữ liệu, even though Mean/SD theo nhóm lô QC only
 * ever showed the levels actually present in the assigned lot group.
 *
 * Fix: defaultAssayLevels() now always starts a new test with a single Mức 1 — other
 * levels are added on demand by applyTargetPick() when the user actually links a lot at
 * that level. pruneUnusedTestLevels() (assets/modules/state.js), run from ensureShape()
 * on every load/merge, also sweeps out any already-existing phantom level entries:
 * never linked to a lot, no Mean ever set, no Mean/SD history, and no QC points — while
 * always keeping at least one level per test.
 */
const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js']);
const plain = (v) => JSON.parse(JSON.stringify(v));

// A phantom, entirely untouched level 3 sitting alongside two real, configured levels
// is pruned; the real levels are untouched.
run(ctx, `
  state.tests=[{id:'T1',name:'Glucose',levels:[
    {level:1,qcLotId:'L1',lot:'AU2121',mean:111.1,sd:10.44,meanSdHistory:[{qcLotId:'L1',lot:'AU2121',mean:111.1,sd:10.44}]},
    {level:2,qcLotId:'L2',lot:'AU2122',mean:280.6,sd:27.6,meanSdHistory:[{qcLotId:'L2',lot:'AU2122',mean:280.6,sd:27.6}]},
    {level:3,mean:null,sd:null,meanSdHistory:[]}
  ]}];
  state.data={T1:[]};
  globalThis.__pruned=pruneUnusedTestLevels();
`);
assert.equal(run(ctx, '__pruned'), 1, 'exactly the phantom level is pruned');
assert.deepEqual(plain(run(ctx, 'state.tests[0].levels.map(l=>l.level)')), [1, 2], 'both real, configured levels remain');

// An unused-looking level that still has QC points recorded is never pruned — those
// points would be orphaned (no level metadata) if the entry were removed.
run(ctx, `
  state.tests=[{id:'T2',name:'Sodium',levels:[
    {level:1,qcLotId:'L1',lot:'X',mean:140,sd:2,meanSdHistory:[{qcLotId:'L1',lot:'X',mean:140,sd:2}]},
    {level:2,mean:null,sd:null,meanSdHistory:[]}
  ]}];
  state.data={T2:[{id:'p1',level:2,date:'2026-07-01',val:139}]};
  globalThis.__keptForData=pruneUnusedTestLevels();
`);
assert.equal(run(ctx, '__keptForData'), 0, 'a level with recorded QC points is not pruned even without a linked lot');
assert.deepEqual(plain(run(ctx, 'state.tests[0].levels.map(l=>l.level)')), [1, 2]);

// A level with only "planned" Mean/SD history (not yet applied) is preserved.
run(ctx, `
  state.tests=[{id:'T3',name:'Potassium',levels:[
    {level:1,qcLotId:'L1',lot:'X',mean:4,sd:0.1,meanSdHistory:[{qcLotId:'L1',lot:'X',mean:4,sd:0.1}]},
    {level:2,mean:null,sd:null,meanSdHistory:[{qcLotId:'L2',lot:'Y',mean:4.5,sd:0.12,planned:true}]}
  ]}];
  state.data={T3:[]};
  globalThis.__keptForPlanned=pruneUnusedTestLevels();
`);
assert.equal(run(ctx, '__keptForPlanned'), 0, 'a level with planned-but-unapplied Mean/SD history is not pruned');

// A test with only a single (even entirely unused) level is left alone — never reduced
// to an empty levels array.
run(ctx, `
  state.tests=[{id:'T4',name:'Chloride',levels:[{level:1,mean:null,sd:null,meanSdHistory:[]}]}];
  state.data={T4:[]};
  globalThis.__soleLevel=pruneUnusedTestLevels();
`);
assert.equal(run(ctx, '__soleLevel'), 0);
assert.equal(run(ctx, 'state.tests[0].levels.length'), 1, 'a test is never left with zero levels');

// If every level on a multi-level test turns out unused, collapse down to the first one
// rather than deleting all of them.
run(ctx, `
  state.tests=[{id:'T5',name:'Calcium',levels:[
    {level:1,mean:null,sd:null,meanSdHistory:[]},
    {level:2,mean:null,sd:null,meanSdHistory:[]}
  ]}];
  state.data={T5:[]};
  globalThis.__allUnused=pruneUnusedTestLevels();
`);
assert.equal(run(ctx, '__allUnused'), 1);
assert.deepEqual(plain(run(ctx, 'state.tests[0].levels.map(l=>l.level)')), [1], 'collapses to the first level instead of an empty array');

// ensureShape() runs QCCore.sanitizeBackup() FIRST (before pruneUnusedTestLevels()),
// which coerces a raw mean:null/sd:null level to mean:0/sd:0 — the prune check must
// still recognize it as unused after that coercion (this is the exact scenario from
// the reported bug: a phantom level showing "Mean 0.00" on Lịch sử dữ liệu, not
// "Mean —"). ensureShape() itself needs settings.js (ensureLabBrandShape), which this
// sandbox doesn't load, so reproduce just the two relevant steps in order instead.
run(ctx, `
  const merged={lab:{},tests:[{id:'T1',name:'Glucose',levels:[
    {level:1,qcLotId:'L1',lot:'AU2121',mean:111.1,sd:10.44,meanSdHistory:[{qcLotId:'L1',lot:'AU2121',mean:111.1,sd:10.44}]},
    {level:2,qcLotId:'L2',lot:'AU2122',mean:280.6,sd:27.6,meanSdHistory:[{qcLotId:'L2',lot:'AU2122',mean:280.6,sd:27.6}]},
    {level:3,mean:null,sd:null,meanSdHistory:[]}
  ]}],data:{T1:[]},machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:[],sigmaData:{},periodLocks:[],teaRefs:[],teaRegistryVersion:2,westgardRules:{}};
  state=QCCore.sanitizeBackup(merged);
  globalThis.__sanitizedMean=state.tests[0].levels[2].mean;
  pruneUnusedTestLevels();
`);
assert.equal(run(ctx, '__sanitizedMean'), 0, 'sanitizeBackup coerces the unset mean to 0, not null, before pruning runs');
assert.deepEqual(plain(run(ctx, 'state.tests[0].levels.map(l=>l.level)')), [1, 2], 'the phantom level is still recognized and pruned after sanitizeBackup coercion');

console.log('Prune unused test levels tests passed');
