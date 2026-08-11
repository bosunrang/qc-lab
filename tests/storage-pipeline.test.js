const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const plain = v => JSON.parse(JSON.stringify(v));

const ctx = loadSandbox([
  'core.js',
  'modules/state.js',
  'modules/qc-domain.js',
  'modules/local-store.js',
  'modules/state-storage.js',
]);

const result = run(ctx, `
  (function(){
    var writes=[],removed=[],fail=false;
    localStorage={
      getItem:function(){return null;},
      setItem:function(key,value){if(fail&&key==='qclab')throw new Error('quota');writes.push([key,value]);},
      removeItem:function(key){removed.push(key);}
    };
    markSaved=function(){};saveTime=function(){return'now';};
    state={value:1};lsRevision=1;lsDirty=true;lsFlush();
    var firstCount=lsSerializeCount,firstJson=writes.find(x=>x[0]==='qclab')[1];
    lsDirty=true;lsFlush();
    var reusedCount=lsSerializeCount;
    state.value=2;lsRevision++;lsDirty=true;lsFlush();
    var changedCount=lsSerializeCount,lastJson=writes.filter(x=>x[0]==='qclab').slice(-1)[0][1];
    lsLastBytes=0;lsLastSerializeMs=0;var smallDelay=lsSaveDelay();
    lsLastBytes=3*1024*1024;var mediumDelay=lsSaveDelay();
    lsLastBytes=9*1024*1024;var largeDelay=lsSaveDelay();
    fail=true;state.value=3;lsRevision++;lsDirty=true;var quotaResult=lsFlush();
    cancelLocalSaveSchedule(); // dừng backoff retry sau ghi thất bại để tiến trình test thoát được
    return{firstCount,reusedCount,changedCount,firstJson,lastJson,smallDelay,mediumDelay,largeDelay,quotaResult,removed};
  })()
`);

const value = JSON.parse(JSON.stringify(result));
assert.equal(value.firstCount, 1);
assert.equal(value.reusedCount, 1, 'same revision reuses the serialized snapshot');
assert.equal(value.changedCount, 2, 'changed revision is serialized exactly once');
assert.equal(value.firstJson, '{"value":1}');
assert.equal(value.lastJson, '{"value":2}');
assert.equal(value.smallDelay, 400);
assert.equal(value.mediumDelay, 700);
assert.equal(value.largeDelay, 1200);
assert.equal(value.quotaResult, false);
assert.deepEqual(value.removed, ['qclab', 'qclab_saved_at'], 'stale local snapshot is removed after a quota failure');

// A synchronous, test-scoped Sigma draft bridges an immediate reload while the
// partitioned IndexedDB write and Firebase update are still asynchronous.
{
  const draftCtx = loadSandbox([
    'core.js',
    'modules/state.js',
    'modules/qc-domain.js',
    'modules/local-store.js',
    'modules/state-storage.js',
  ]);
  const recovered = run(draftCtx, `(function(){
    var store={};
    localStorage={
      getItem:function(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},
      setItem:function(k,v){store[k]=String(v);},
      removeItem:function(k){delete store[k];}
    };
    state={tests:[{id:'T1',name:'Sodium',levels:[{level:1}]}],data:{},sigmaData:{T1:[{id:'P1',period:'2026-07',lv:{1:{cv:1.25,biasEqa:2.5}}}]},lotGroups:[],qcLots:[]};
    persistSigmaDraft('T1');
    var draft=JSON.parse(store.qclab_sigma_draft),stamp=draft.savedAt;
    store.qclab_saved_at=String(stamp+10);
    state.sigmaData={T1:[{id:'P1',period:'2026-07',lv:{}}]};
    var ok=recoverPendingSigmaDraft(),level=state.sigmaData.T1[0].lv[1];
    clearSigmaDraftThrough(stamp-1);var kept=!!store.qclab_sigma_draft;
    clearSigmaDraftThrough(stamp);var cleared=!store.qclab_sigma_draft;
    return{ok,level,kept,cleared,dirty:lsDirty};
  })()`);
  const draft = JSON.parse(JSON.stringify(recovered));
  assert.equal(draft.level.cv, 1.25);
  assert.equal(draft.level.biasEqa, 2.5);
  assert.equal(draft.ok, true, 'a local IndexedDB commit is not a Firebase acknowledgement');
  assert.equal(draft.kept, true, 'an older completed write cannot erase a newer Sigma draft');
  assert.equal(draft.cleared, true, 'the matching completed sync clears its recovered draft');
  assert.equal(draft.dirty, true, 'recovered Sigma data re-enters the persistence pipeline');
}

// Incremental IndexedDB writes overwrite the active slot's shell + dirty test
// partitions in place; only a FULL write (dirtyTestIds=null) rotates to the other
// slot, which is what makes an interrupted write recoverable. Left unchecked, a
// long streak of incremental-only saves (a normal day of per-test QC entry) could
// mean the "safe" other slot is many generations stale — an interruption at just
// the wrong moment loses everything since the last full rotation, not just the
// one save in flight. persistLocalSnapshot() now forces a periodic full rotation
// after LS_FULL_ROTATE_MAX_INCREMENTALS consecutive incremental writes (or after
// LS_FULL_ROTATE_MAX_MS elapsed) to bound that window instead of leaving it open-ended.
(async () => {
  const fakeIndexedDb = `
    var __records=new Map(),__hasStore=false;
    var __db={
      objectStoreNames:{contains:function(){return __hasStore;}},
      createObjectStore:function(){__hasStore=true;},
      close:function(){},
      transaction:function(){return{objectStore:function(){return{
        get:function(key){var req={};Promise.resolve().then(function(){req.result=__records.get(key);if(req.onsuccess)req.onsuccess();});return req;},
        put:function(value){var req={};Promise.resolve().then(function(){__records.set(value.key,value);if(req.onsuccess)req.onsuccess();});return req;},
        delete:function(key){var req={};Promise.resolve().then(function(){__records.delete(key);if(req.onsuccess)req.onsuccess();});return req;}
      };}};}
    };
    indexedDB={open:function(){var req={result:__db};Promise.resolve().then(function(){if(req.onupgradeneeded)req.onupgradeneeded();if(req.onsuccess)req.onsuccess();});return req;}};
  `;
  const rotateCtx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js', 'generated/modular-pilot.js']);
  const rotation = await run(rotateCtx, `(async function(){
    ${fakeIndexedDb}
    localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
    markSaved=function(){};saveTime=function(){return'now';};
    var calls=[],original=LocalStore.writePartitioned;
    LocalStore.writePartitioned=function(s,slot,opts){calls.push(opts&&opts.dirtyTestIds);return original(s,slot,opts);};
    LS_FULL_ROTATE_MAX_INCREMENTALS=3;LS_FULL_ROTATE_MAX_MS=24*60*60*1000; // time-based threshold disabled for this test (day-long window)
    state={tests:[],data:{T1:[{id:'p1',val:1}]},sigmaData:{}};
    lsFullDirty=true;lsDirty=true;await lsFlush();await partitionWrite; // seed: 1st write is always full (initial slot)
    for(var i=0;i<5;i++){
      lsDirtyTestIds.add('T1');lsRevision++;lsDirty=true;
      await lsFlush();await partitionWrite;
    }
    return{calls:calls.slice(1)}; // drop the seed write, keep only the 5 triggered incremental-eligible writes
  })()`);
  const modes = plain(rotation).calls.map(dirtyTestIds => dirtyTestIds === null ? 'full' : 'incremental');
  assert.deepEqual(modes, ['incremental', 'incremental', 'incremental', 'full', 'incremental'], 'after LS_FULL_ROTATE_MAX_INCREMENTALS consecutive incremental writes the next write is forced full, bounding how many increments can be lost to an interrupted write');

  // While the boot shell is still hydrating, state.data is empty — a flush then
  // would truncate the active slot's manifest to an empty test list and lose
  // every QC point in the slot. persistLocalSnapshot() must defer (stay dirty,
  // reschedule) until hydration flips localLoadStatus off 'partition-shell'.
  const guardCtx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js']);
  const guard = await run(guardCtx, `(async function(){
    ${fakeIndexedDb}
    localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
    markSaved=function(){};saveTime=function(){return'now';};
    var calls=0,original=LocalStore.writePartitioned;
    LocalStore.writePartitioned=function(s,slot,opts){calls++;return original(s,slot,opts);};
    localLoadStatus='partition-shell';
    state={tests:[],data:{},sigmaData:{}};
    lsRevision++;lsDirty=true;
    var deferred=lsFlush(),dirtyWhileShell=lsDirty;
    localLoadStatus='partitioned';
    lsRevision++;lsDirty=true;await lsFlush();await partitionWrite;
    cancelLocalSaveSchedule();
    return{deferred,calls,dirtyWhileShell};
  })()`);
  const guardResult = plain(guard);
  assert.equal(guardResult.deferred, false, 'a flush during hydration reports not-persisted');
  assert.equal(guardResult.dirtyWhileShell, true, 'a deferred flush keeps the dirty flag');
  assert.equal(guardResult.calls, 1, 'nothing is written until hydration completes');

  // A failed write used to leave lsDirty set with no retry until the next user
  // action. Failures now schedule a bounded backoff retry, and the next
  // successful write resets the backoff counter.
  const retryCtx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js']);
  const retry = await run(retryCtx, `(async function(){
    ${fakeIndexedDb}
    localStorage={getItem:function(){return null;},setItem:function(){},removeItem:function(){}};
    markSaved=function(){};saveTime=function(){return'now';};
    var original=LocalStore.writePartitioned;
    LocalStore.writePartitioned=function(){return Promise.reject(new Error('idb down'));};
    state={tests:[],data:{},sigmaData:{}};
    lsRevision++;lsDirty=true;
    lsFlush();await partitionWrite;
    var afterFail={dirty:lsDirty,full:lsFullDirty,failures:lsSaveFailures,retryPending:lsSaveT!==null};
    LocalStore.writePartitioned=original;
    lsRevision++;await lsFlush();await partitionWrite;
    var afterOk={failures:lsSaveFailures};
    cancelLocalSaveSchedule();
    return{afterFail,afterOk};
  })()`);
  const retryResult = plain(retry);
  assert.equal(retryResult.afterFail.dirty, true, 'a failed write keeps the state dirty');
  assert.equal(retryResult.afterFail.full, true, 'a failed write forces a full write next time');
  assert.equal(retryResult.afterFail.retryPending, true, 'a failed write schedules a retry instead of waiting for the next user action');
  assert.ok(retryResult.afterFail.failures >= 1, 'the backoff counter advances');
  assert.equal(retryResult.afterOk.failures, 0, 'a successful write resets the backoff');

  // Boot path end-to-end: a valid qclab_boot record loads the shell first
  // (empty data, status 'partition-shell'), then hydration reconstructs the
  // full state from the partitions. This is the only reader of qclab_boot and
  // the only caller of adoptValidatedState's shell path — cover it explicitly.
  const bootCtx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js']);
  const boot = await run(bootCtx, `(async function(){
    ${fakeIndexedDb}
    var store={};
    localStorage={getItem:function(k){return Object.prototype.hasOwnProperty.call(store,k)?store[k]:null;},setItem:function(k,v){store[k]=String(v);},removeItem:function(k){delete store[k];}};
    markSaved=function(){};saveTime=function(){return'now';};
    ensureLabBrandShape=function(){}; // settings.js (module render) không nạp vào sandbox — ensureShape gọi nó
    state={tests:[{id:'T1',name:'Sodium',levels:[{level:1}]}],data:{T1:[{id:'p1',date:'2026-07-19',level:1,val:10}]},sigmaData:{},lotGroups:[],qcLots:[]};
    lsFullDirty=true;lsDirty=true;await lsFlush();await partitionWrite; // writes partitions + qclab_boot
    var booted=load(),shellStatus=localLoadStatus,shellDataEmpty=Object.keys(state.data||{}).length===0;
    var hydrated=await storageHydrationPromise;
    cancelLocalSaveSchedule();
    return{booted,shellStatus,shellDataEmpty,hydrated,status:localLoadStatus,points:(state.data.T1||[]).length};
  })()`);
  const bootResult = plain(boot);
  assert.equal(bootResult.booted, true, 'the boot record loads successfully');
  assert.equal(bootResult.shellStatus, 'partition-shell', 'boot exposes the shell-first status');
  assert.equal(bootResult.shellDataEmpty, true, 'the shell state has no QC data before hydration');
  assert.equal(bootResult.hydrated, true, 'hydration completes');
  assert.equal(bootResult.status, 'partitioned', 'status flips to partitioned after hydration');
  assert.equal(bootResult.points, 1, 'QC points round-trip through the partitioned boot');

  console.log('Storage pipeline tests passed');
})().catch(err => { console.error(err); process.exitCode = 1; });
