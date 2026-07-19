const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox([
  'core.js',
  'modules/state.js',
  'modules/qc-domain.js',
  'modules/local-store.js',
  'modules/state-storage.js',
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

console.log('Cache invalidation tests passed');
