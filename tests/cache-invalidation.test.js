const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js',
  'modules/state.js',
  'modules/qc-domain.js',
  'modules/local-store.js',
  'modules/state-storage.js',
  'generated/modular-pilot.js',
]);

function seed() {
  run(ctx, `
    pointsCache=new Map([['T1|1',['t1']],['T2|1',['t2']]]);
    pointsIndexCache=new Map([['T1|1',['t1']],['T2|1',['t2']]]);
    pointsLotCache=new Map([['T1|1|L1|0',['t1']],['T2|1|L2|0',['t2']]]);
    wgMemo=new Map([['T1',{id:'t1'}],['T2',{id:'t2'}]]);
    acceptedMemo=new Map([['T1|1|0',['t1']],['T2|1|0',['t2']]]);
    cusumMemo=new Map([['T1|1',{id:'t1'}],['T2|1',{id:'t2'}]]);
    derivedIndex={sentinel:true};
  `);
}

seed();
run(ctx, "state.data={T1:[{level:1,date:'2026-01-01',runId:'2026-01-01-1',val:1}],T2:[{level:1,date:'2026-01-01',runId:'2026-01-01-1',val:2}]};pointsOf('T1',1);pointsOf('T2',1)");
run(ctx, "state.data.T1[0].voided=true;clearDerivedForTest('T1')");
assert.equal(run(ctx, "pointsOf('T1',1).length"), 0, 'test-scoped invalidation refreshes the TypeScript point cache after an in-place edit');
assert.equal(run(ctx, "pointsOf('T2',1).length"), 1, 'test-scoped invalidation preserves the other test point cache');

seed();
run(ctx, 'invalidateDerivedForSave({clearDerived:false})');
assert.equal(run(ctx, 'pointsCache.size'), 2, 'unrelated saves keep point caches');
assert.equal(run(ctx, 'wgMemo.size'), 2, 'unrelated saves keep Westgard caches');
assert.equal(run(ctx, 'derivedIndex.sentinel'), true, 'unrelated saves keep the structural index');

run(ctx, "invalidateDerivedForSave({testId:'T1'})");
assert.equal(run(ctx, "pointsCache.has('T1|1')"), false, 'test-scoped save clears the changed test');
assert.equal(run(ctx, "pointsCache.has('T2|1')"), true, 'test-scoped save preserves other tests');
assert.equal(run(ctx, "wgMemo.has('T1')"), false);
assert.equal(run(ctx, "wgMemo.has('T2')"), true);
assert.equal(run(ctx, 'derivedIndex.sentinel'), true, 'test-scoped save preserves unrelated structural indexes');

seed();
run(ctx, "invalidateDerivedForSave({testIds:['T1','T2','T1']})");
assert.equal(run(ctx, 'pointsCache.size'), 0, 'testIds supports multiple changed tests');
assert.equal(run(ctx, 'wgMemo.size'), 0);

seed();
run(ctx, 'invalidateDerivedForSave({})');
assert.equal(run(ctx, 'pointsCache.size'), 0, 'default save remains fail-safe and clears every cache');
assert.equal(run(ctx, 'wgMemo.size'), 0);
assert.equal(run(ctx, 'derivedIndex'), null, 'global invalidation rebuilds the structural index');

const savePlans = JSON.parse(JSON.stringify(run(ctx, `[
  saveCommandPolicy({}),
  saveCommandPolicy({testIds:['T1','T2','T1']}),
  saveCommandPolicy({sigmaTestId:'T3',clearDerived:false,cloud:false})
]`)));
assert.deepEqual(savePlans[0], {derivedTestIds:[],storageTestIds:[],fullDirty:true,persistSigmaDraft:false,pushCloud:true},
  'default save is a full persistence and cache-invalidating command');
assert.deepEqual(savePlans[1], {derivedTestIds:['T1','T2'],storageTestIds:['T1','T2'],fullDirty:false,persistSigmaDraft:false,pushCloud:true},
  'test-scoped saves keep a de-duplicated incremental persistence plan');
assert.deepEqual(savePlans[2], {derivedTestIds:null,storageTestIds:['T3'],fullDirty:false,persistSigmaDraft:true,pushCloud:false},
  'Sigma draft saves preserve derived caches and can remain local-only');

console.log('Cache invalidation tests passed');
