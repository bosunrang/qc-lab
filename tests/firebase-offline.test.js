const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);

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
  const ctx2 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
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
  const ctx3 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
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

  // The generated TypeScript lifecycle service must retain the legacy
  // disconnect ordering: stop polling, cancel pending writes, reset retries,
  // detach the listener, then clear the Firebase session.
  const ctx4 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const disconnected = run(ctx4, `(function(){
    var detached=0,cleared=0;
    clearTimeout=function(){cleared++;};clearInterval=function(){};
    fb.ready=true;fb.initialized=true;fb.pullT=1;fbSaveT=2;fb.retryT=3;fb.retryMs=4000;
    fb.ref={off:function(){detached++;}};fb.synced={lab:{name:'Lab'}};fb.seenSig='seen';fb.authUser={uid:'U1'};
    fbDisconnect(true);
    return {detached,cleared,ready:fb.ready,initialized:fb.initialized,ref:fb.ref,synced:fb.synced,seenSig:fb.seenSig,authUser:fb.authUser,retryT:fb.retryT,retryMs:fb.retryMs,saveT:fbSaveT,pullT:fb.pullT};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(disconnected)), {
    detached:1, cleared:2, ready:false, initialized:false, ref:null, synced:null,
    seenSig:null, authUser:null, retryT:null, retryMs:1000, saveT:null, pullT:null,
  }, 'TypeScript Firebase disconnect bridge keeps the complete cleanup lifecycle');

  const ctx5 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const fullSync = await run(ctx5, `(async()=>{
    document={getElementById:function(){return null;}};
    localStorage={setItem:function(){},removeItem:function(){},getItem:function(){return null;}};
    state={lab:{name:'Lab'},activity:[],activityAnchor:'',data:{},sigmaData:{}};
    var saved=null;
    fb.ready=true;fb.initialized=true;fb.clientId='C1';fb.dirty=true;fb.ref={set:async function(value){saved=value;}};
    var ok=await syncNow();
    var threw=false;fb.dirty=true;fb.ref={set:async function(){throw new Error('offline');}};
    try{await syncNow();}catch(e){threw=e.message==='offline';}
    return {ok,savedClient:saved&&saved._client,clean:!fb.dirty,synced:fb.synced===saved,threw};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(fullSync)), {
    ok:true, savedClient:'C1', clean:false, synced:true, threw:true,
  }, 'TypeScript full-sync bridge writes the full snapshot and preserves legacy error propagation');

  const ctx6 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const scheduled = run(ctx6, `(function(){
    document={getElementById:function(){return null;}};navigator={onLine:true};
    var timers=[],cleared=[];setTimeout=function(fn,delay){timers.push({fn:fn,delay:delay});return timers.length;};clearTimeout=function(timer){cleared.push(timer);};
    fb.ready=true;fb.initialized=true;fb.ref={};fbSaveT=9;fb.retryT=null;fb.retryMs=1000;
    scheduleFbPush();
    var queued={timer:fbSaveT,delay:timers[0]&&timers[0].delay,cleared:cleared[0]};
    navigator.onLine=false;scheduleFbPush();
    return {queued,afterOffline:fbSaveT,timerCount:timers.length};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(scheduled)), {
    queued:{timer:1,delay:500,cleared:9}, afterOffline:1, timerCount:1,
  }, 'TypeScript push scheduler keeps the legacy debounce and offline behavior');

  const ctx7 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const emptySnapshot = await run(ctx7, `(async()=>{
    window={QCLAB_CLOUD:null};
    document={getElementById:function(){return null;}};navigator={onLine:true};
    var timers=[];setTimeout=function(fn,delay){timers.push({fn:fn,delay:delay});return timers.length;};clearTimeout=function(){};
    state={data:{T1:[{id:'P1'}]},activity:[]};
    fb.ready=false;fb.initialized=false;fb.ref={};fb.dirty=false;fb.synced={old:true};fb.seenSig=null;fb.retryT=null;fb.retryMs=1000;
    await fbHandleValue(null,{silent:true});
    return {ready:fb.ready,initialized:fb.initialized,synced:fb.synced,timer:fbSaveT,delay:timers[0]&&timers[0].delay};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(emptySnapshot)), {
    ready:true, initialized:true, synced:null, timer:1, delay:500,
  }, 'TypeScript empty-snapshot bridge seeds a blank room from first-connect local QC data');

  const ctx8 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const invalidSnapshot = await run(ctx8, `(async()=>{
    window={QCLAB_CLOUD:null};document={getElementById:function(){return null;}};
    state={lab:{name:'Lab'},activity:[],data:{},sigmaData:{}};
    fb.ready=false;fb.initialized=false;fb.seenSig=null;
    await fbHandleValue({data:[]},{silent:true});
    return {ready:fb.ready,initialized:fb.initialized};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(invalidSnapshot)), {ready:true,initialized:true},
    'TypeScript invalid-snapshot bridge leaves Firebase ready so a later valid cloud write can recover');

  const ctx9 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const rejectedAudit = run(ctx9, `(function(){
    window={QCLAB_CLOUD:null};document={getElementById:function(){return null;}};clearTimeout=function(){};clearInterval=function(){};
    fb.ready=true;fb.initialized=true;fb.ref={off:function(){}};fb.retryT=null;fb.retryMs=1000;
    return {result:fbRejectBrokenAudit('Nhật ký cloud',{brokenIndex:1,reason:'hash sai'}),ready:fb.ready,ref:fb.ref,retryMs:fb.retryMs};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(rejectedAudit)), {result:false,ready:false,ref:null,retryMs:1000},
    'TypeScript audit-rejection bridge disconnects Firebase while retaining the local state');

  const ctx10 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const remoteRender = run(ctx10, `(function(){
    var modalOpen=true,timers=[],renders=0;
    document={getElementById:function(id){return id==='modalRoot'?{children:{length:modalOpen?1:0}}:id==='main'?{}:null;},activeElement:null};
    currentUser={id:'U1'};rerender=function(){renders++;};clearTimeout=function(){};setTimeout=function(fn,delay){timers.push({fn:fn,delay:delay});return timers.length;};
    applyRemoteRender();
    modalOpen=false;timers[0].fn();
    return {deferredDelay:timers[0].delay,renders,pending:fb.pendingRenderT};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(remoteRender)), {deferredDelay:1500,renders:1,pending:1},
    'TypeScript remote-render bridge defers redraw while a modal is open, then renders once safe');

  const ctx11 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const startedSession = await run(ctx11, `(async()=>{
    var user={uid:'U1',email:'u@example.test'},listener=0,intervals=[];
    window={QCLAB_CLOUD:{config:{apiKey:'key',authDomain:'auth',databaseURL:'https://db',projectId:'project',appId:'app'},labCode:'lab-a',anonymous:true}};
    document={getElementById:function(){return null;}};clearTimeout=function(){};clearInterval=function(){};setInterval=function(fn,delay){intervals.push(delay);return intervals.length;};
    var auth={setPersistence:async function(){},onAuthStateChanged:function(onValue){Promise.resolve().then(function(){onValue(user);});return function(){};},currentUser:user};
    firebase={apps:[],initializeApp:function(config){return {options:config};},auth:function(){return auth;},database:function(){return {ref:function(path){return {path:path,on:function(){listener++;},off:function(){}};}};}};
    firebase.auth.Auth={Persistence:{LOCAL:'local'}};
    var ok=await initFirebase();
    return {ok,uid:fb.authUser&&fb.authUser.uid,path:fb.ref&&fb.ref.path,listener,pullDelay:intervals[0]};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(startedSession)), {
    ok:true, uid:'U1', path:'qclab-shared/lab-a', listener:1, pullDelay:8000,
  }, 'TypeScript Firebase session-start bridge initializes auth, listener and pull lifecycle');

  const ctx12 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const cloudStatus = run(ctx12, `(function(){
    var element={className:'',innerHTML:''};document={getElementById:function(){return element;}};
    setCloudStatus('<img src=x>',true);
    return {className:element.className,html:element.innerHTML};
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(cloudStatus)), {
    className:'cloud connected', html:'<b>Đang kết nối</b><small>&lt;img src=x&gt;</small>',
  }, 'TypeScript cloud-status presentation retains HTML escaping');

  const ctx13 = loadSandbox(['core.js', 'modules/state.js', 'modules/firebase-sync.js', 'modules/state-storage.js', 'modules/qc-domain.js', 'generated/modular-pilot.js']);
  const saveStatus = run(ctx13, `(function(){
    var element={innerHTML:''};document={getElementById:function(){return element;}};
    markSaved('đã lưu','vừa xong');
    return element.innerHTML;
  })()`);
  assert.equal(saveStatus, 'Lưu trữ: <b>đã lưu</b><br>vừa xong',
    'TypeScript save-status bridge keeps the legacy status rendering contract');
  console.log('Firebase offline retry tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
