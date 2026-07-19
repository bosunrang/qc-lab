const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js']);

const result = run(ctx, `
  (async()=>{
    window={QCLAB_CLOUD:null};
    document={getElementById:function(){return null;},addEventListener:function(){}};
    localStorage={setItem:function(){}};
    navigator={onLine:true};
    clearTimeout=function(){};
    var timers=[];
    setTimeout=function(fn,delay){timers.push({fn,delay});return timers.length;};
    var attempts=0;
    var base={lab:{name:'Lab'},machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],tests:[],actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:[],periodLocks:[],westgardRules:{},configMigrationVersion:1,data:{},sigmaData:{}};
    state=JSON.parse(JSON.stringify(base));
    state.tests=[{id:'T1',name:'Glucose'}];
    fb.ready=true;fb.initialized=true;fb.ref={update:function(){attempts++;return attempts===1?Promise.reject(new Error('offline')):Promise.resolve();}};
    fb.synced=JSON.parse(JSON.stringify(base));fb.dirty=true;fb.retryT=null;fb.retryMs=1000;
    await fbFlushPush();
    var afterFailure={attempts,dirty:fb.dirty,retryPending:fb.retryT!==null,retryDelay:timers[0]&&timers[0].delay};
    await timers[0].fn();
    var afterRetry={attempts,dirty:fb.dirty,retryPending:fb.retryT!==null,retryMs:fb.retryMs};
    return {afterFailure,afterRetry};
  })()
`);

(async()=>{
  const value = await result;
  assert.deepEqual(JSON.parse(JSON.stringify(value.afterFailure)), {
    attempts:1, dirty:true, retryPending:true, retryDelay:1000,
  }, 'failed Firebase writes keep local dirty state and schedule a bounded retry');
  assert.deepEqual(JSON.parse(JSON.stringify(value.afterRetry)), {
    attempts:2, dirty:false, retryPending:false, retryMs:1000,
  }, 'successful retry clears dirty state and resets backoff');
  // Pushes can also start with fb.dirty=false (first-connect room seeding,
  // post-merge convergence) — a failure there must still re-mark dirty and
  // retry, otherwise that push is silently dropped until the next user edit.
  const ctx2 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js']);
  const result2 = run(ctx2, `
    (async()=>{
      window={QCLAB_CLOUD:null};
      document={getElementById:function(){return null;},addEventListener:function(){}};
      localStorage={setItem:function(){}};
      navigator={onLine:true};
      clearTimeout=function(){};
      var timers=[];
      setTimeout=function(fn,delay){timers.push({fn,delay});return timers.length;};
      var attempts=0;
      var base={lab:{name:'Lab'},machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],tests:[],actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:[],periodLocks:[],westgardRules:{},configMigrationVersion:1,data:{},sigmaData:{}};
      state=JSON.parse(JSON.stringify(base));
      state.tests=[{id:'T1',name:'Glucose'}];
      fb.ready=true;fb.initialized=true;fb.ref={update:function(){attempts++;return attempts===1?Promise.reject(new Error('offline')):Promise.resolve();}};
      fb.synced=JSON.parse(JSON.stringify(base));fb.dirty=false;fb.retryT=null;fb.retryMs=1000;
      await fbFlushPush();
      var afterFailure={attempts,dirty:fb.dirty,retryPending:fb.retryT!==null};
      await timers[0].fn();
      var afterRetry={attempts,dirty:fb.dirty};
      return {afterFailure,afterRetry};
    })()
  `);
  const value2 = JSON.parse(JSON.stringify(await result2));
  assert.equal(value2.afterFailure.dirty, true, 'a failed push re-marks local state dirty even when it started clean');
  assert.equal(value2.afterFailure.retryPending, true, 'a failed clean-start push still schedules a retry');
  assert.equal(value2.afterRetry.attempts, 2, 'the scheduled retry actually re-runs the push');
  assert.equal(value2.afterRetry.dirty, false, 'the retry clears dirty on success');

  // The baseline snapshot cache keys on fb.synced identity: the same baseline
  // object must not be re-serialized on every push, and a new baseline object
  // must recompute. Guard the identity-keyed contract directly.
  const ctx3 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js']);
  const cache = run(ctx3, `(function(){
    var base={lab:{name:'Lab'},tests:[],data:{},sigmaData:{}};
    var a=fbSyncedSnapKeys(base),b=fbSyncedSnapKeys(base);
    var other=fbSyncedSnapKeys({lab:{name:'Lab'},tests:[],data:{},sigmaData:{}});
    var afterNull=fbSyncedSnapKeys(null);
    return{same:a===b,recomputed:a!==other,sameContent:a.keys.lab===other.keys.lab,nullOk:!!afterNull};
  })()`);
  assert.equal(cache.same, true, 'identical baseline reuses the cached snapshot');
  assert.equal(cache.recomputed, true, 'a new baseline object recomputes');
  assert.equal(cache.sameContent, true, 'recomputation yields the same content');
  assert.equal(cache.nullOk, true, 'a null baseline is handled');
  console.log('Firebase offline retry tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
