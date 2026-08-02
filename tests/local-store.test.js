const assert = require('node:assert/strict');
const { loadSandbox, run } = require('./helpers/sandbox');

const fakeIndexedDb = `
  var __records=new Map(),__hasStore=false,__openCount=0;
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
  indexedDB={open:function(){__openCount++;var req={result:__db};Promise.resolve().then(function(){if(req.onupgradeneeded)req.onupgradeneeded();if(req.onsuccess)req.onsuccess();});return req;}};
`;

(async()=>{
  {
    const ctx = loadSandbox(['modules/local-store.js']);
    const result = await run(ctx, `
      ${fakeIndexedDb}
      (async()=>{const written=await LocalStore.write({version:1,name:'QC'});const saved=await LocalStore.read();const serialized=await LocalStore.writeSerialized('{"version":2,"name":"QC JSON"}');const savedJson=await LocalStore.read();__db.onversionchange();const reopened=await LocalStore.read();const cleared=await LocalStore.clear();const empty=await LocalStore.read();return{written,saved,serialized,savedJson,reopened,cleared,empty,openCount:__openCount};})()
    `);
    assert.equal(result.written, true);
    assert.deepEqual(JSON.parse(JSON.stringify(result.saved.state)), { version: 1, name: 'QC' });
    assert.equal(result.serialized, true);
    assert.equal(result.savedJson.json, '{"version":2,"name":"QC JSON"}');
    assert.equal(result.reopened.json, '{"version":2,"name":"QC JSON"}');
    assert.equal(result.openCount, 2);
    assert.equal(result.cleared, true);
    assert.equal(result.empty, null);
  }

  {
    const ctx = loadSandbox(['modules/local-store.js']);
    const result = await run(ctx, `
      ${fakeIndexedDb}
      (async()=>{
        const first=await LocalStore.writePartitioned({lab:{name:'Partitioned'},tests:[{id:'T1'},{id:'T2'}],data:{T1:[{id:'p1',date:'2026-07-14',val:10}],T2:[{id:'p2',date:'2026-07-14',val:20}]},users:[]},'');
        const restored=await LocalStore.readPartitioned();
        const second=await LocalStore.writePartitioned({lab:{name:'Partitioned 2'},tests:[{id:'T1'},{id:'T2'}],data:{T1:[{id:'p1',date:'2026-07-14',val:11}],T2:[{id:'p2',date:'2026-07-14',val:20}]},users:[]},first.slot);
        const latest=await LocalStore.readPartitioned();
        const previous=await LocalStore.readPartitioned(first.slot);
        const third=await LocalStore.writePartitioned({lab:{name:'Partitioned 3'},tests:[{id:'T1'},{id:'T2'}],data:{T1:[{id:'p1',date:'2026-07-14',val:12}],T2:[{id:'p2',date:'2026-07-14',val:20}]},users:[]},second.slot,{dirtyTestIds:['T1']});
        const incremental=await LocalStore.readPartitioned();
        const fourth=await LocalStore.writePartitioned({lab:{name:'Partitioned 4'},tests:[{id:'T1'}],data:{T1:[{id:'p1',date:'2026-07-14',val:12}]},users:[]},third.slot,{dirtyTestIds:['T2']});
        const afterRemoval=await LocalStore.readPartitioned(),removedRecordExists=__records.has('partition:'+fourth.slot+':data:T2');
        const manifest=__records.get('partition:'+fourth.slot+':manifest'),dirty=__records.get('partition:'+fourth.slot+':data:T1');
        __records.set(dirty.key,{...dirty,savedAt:manifest.savedAt+1,points:[{id:'broken',val:99}]});
        const recovered=await LocalStore.readPartitioned();
        const cleared=await LocalStore.clear(),afterClear=await LocalStore.readPartitioned();
        return{firstSlot:first.slot,secondSlot:second.slot,thirdSlot:third.slot,thirdMode:third.mode,partitionsWritten:third.partitionsWritten,restored,latest,previous,incremental,afterRemoval,removedRecordExists,recovered,cleared,afterClear};
      })()
    `);
    assert.equal(result.firstSlot, 'a');
    assert.equal(result.secondSlot, 'b');
    assert.equal(result.restored.state.data.T1[0].val, 10);
    assert.equal(result.latest.state.lab.name, 'Partitioned 2');
    assert.equal(result.latest.state.data.T1[0].val, 11);
    assert.equal(result.previous.state.data.T1[0].val, 10, 'previous slot remains recoverable until the next rotation');
    assert.equal(result.thirdSlot, 'b', 'incremental writes stay in the active slot');
    assert.equal(result.thirdMode, 'incremental');
    assert.equal(result.partitionsWritten, 1, 'only the dirty test partition is rewritten');
    assert.equal(result.incremental.state.data.T1[0].val, 12);
    assert.equal(result.incremental.state.data.T2[0].val, 20, 'unchanged partitions remain available');
    assert.equal(result.afterRemoval.state.data.T2, undefined, 'removed tests leave the active manifest');
    assert.equal(result.removedRecordExists, false, 'orphaned test partitions are deleted');
    assert.equal(result.recovered.slot, 'a', 'an interrupted incremental write falls back to the previous complete slot');
    assert.equal(result.recovered.state.data.T1[0].val, 10);
    assert.equal(result.cleared, true);
    assert.equal(result.afterClear, null, 'clear removes legacy and partitioned snapshots');
  }

  {
    const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js', 'modules/settings.js']);
    const result = await run(ctx, `
      ${fakeIndexedDb}
      localStorage={getItem:function(){return null;},setItem:function(){}};
      (async()=>{
        await LocalStore.write({lab:{name:'Restored'},tests:[{id:'T1',name:'Glucose',levels:[{level:1}]}],machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:[],sigmaData:{},periodLocks:[],westgardRules:{},configMigrationVersion:1});
        const ok=await loadBootState();
        return{ok,name:state.lab.name,testId:state.tests[0]&&state.tests[0].id,source:localLoadStatus};
      })()
    `);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true, name: 'Restored', testId: 'T1', source: 'indexeddb' });
  }

  {
    const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js', 'modules/settings.js']);
    const result = await run(ctx, `
      ${fakeIndexedDb}
      localStorage={getItem:function(){return null;},setItem:function(){}};
      (async()=>{
        const snapshot={lab:{name:'Restored JSON'},tests:[{id:'T2',name:'ALT',levels:[{level:1}]}],machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{},actions:[],activity:[],users:[],reagentTests:[],reagentOperators:[],reagentSampleTypes:[],sigmaData:{},periodLocks:[],westgardRules:{},configMigrationVersion:1};
        await LocalStore.writeSerialized(JSON.stringify(snapshot));
        const ok=await loadBootState();
        return{ok,name:state.lab.name,testId:state.tests[0]&&state.tests[0].id,source:localLoadStatus};
      })()
    `);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true, name: 'Restored JSON', testId: 'T2', source: 'indexeddb' });
  }

  {
    const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/qc-domain.js', 'modules/local-store.js', 'modules/state-storage.js', 'modules/settings.js']);
    const result = await run(ctx, `
      ${fakeIndexedDb}
      var __ls=new Map();localStorage={getItem:function(k){return __ls.has(k)?__ls.get(k):null;},setItem:function(k,v){__ls.set(k,String(v));},removeItem:function(k){__ls.delete(k);}};
      (async()=>{
        const snapshot={lab:{name:'Fast shell'},tests:[{id:'T3',name:'AST',levels:[{level:1,mean:10,sd:1}]}],machines:[],instruments:[],assayGroups:[],qcPanels:[],lotTransitions:[],lotGroups:[],qcLots:[],data:{T3:[{id:'p1',date:'2026-07-14',runId:'2026-07-14-1',level:1,lot:'',val:10,qcMean:10,qcSd:1}]},actions:[],activity:[],users:[{id:'u1',username:'admin',name:'Admin',role:'admin',passHash:'x',active:true}],reagentTests:[],reagentOperators:[],reagentSampleTypes:[],sigmaData:{},periodLocks:[],westgardRules:{},configMigrationVersion:1};
        const written=await LocalStore.writePartitioned(snapshot,'');
        localStorage.setItem('qclab_boot',JSON.stringify({format:1,slot:written.slot,savedAt:written.savedAt,shell:written.shell}));
        const ok=await loadBootState(),shellPoints=(state.data.T3||[]).length,statusBefore=localLoadStatus;
        const hydrated=await storageHydrationPromise;
        return{ok,shellPoints,statusBefore,hydrated,points:state.data.T3.length,value:state.data.T3[0].val,statusAfter:localLoadStatus};
      })()
    `);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok:true, shellPoints:0, statusBefore:'partition-shell', hydrated:true, points:1, value:10, statusAfter:'partitioned' });
  }

  {
    const ctx = loadSandbox(['modules/local-store.js']);
    const result = await run(ctx, `(async()=>({supported:LocalStore.supported(),read:await LocalStore.read(),write:await LocalStore.write({}),clear:await LocalStore.clear()}))()`);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { supported: false, read: null, write: false, clear: false });
  }

  {
    let dialog=null;
    const ctx = loadSandbox(['core.js', 'modules/state.js', 'modules/settings.js'],{
      navigator:{storage:{estimate:async()=>({usage:1572864,quota:104857600,usageDetails:{indexedDB:1048576}})}},
      infoDialog:async(message,opts)=>{dialog={message,opts};}
    });
    await run(ctx, `state.data={T1:[{id:'p1'},{id:'p2'}],T2:[{id:'p3'}]};checkStorageUsage()`);
    assert.match(dialog.message,/Số điểm QC: 3\./);
    assert.match(dialog.message,/Dung lượng IndexedDB: 1\.0 MB\./);
    assert.match(dialog.message,/Tổng dung lượng app đang dùng: 1\.5 MB \/ 100 MB \(1\.50%\)\./);
    assert.deepEqual(JSON.parse(JSON.stringify(dialog.opts)),{title:'Dung lượng cục bộ',type:'success'});
  }

  console.log('Local store tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
