/* ===== INDEXEDDB LOCAL STORE ===== */
const LocalStore=(()=>{
  const DB_NAME='qclab-local',DB_VERSION=1,STORE='snapshots',KEY='state';
  let openPromise=null;
  const supported=()=>typeof indexedDB!=='undefined';
  function open(){
    if(!supported())return Promise.resolve(null);
    if(openPromise)return openPromise;
    openPromise=new Promise((resolve,reject)=>{
      let request;
      try{request=indexedDB.open(DB_NAME,DB_VERSION);}catch(e){reject(e);return;}
      request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'key'});};
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();openPromise=null;};resolve(db);};
      request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
      request.onblocked=()=>reject(new Error('IndexedDB is blocked'));
    }).catch(error=>{openPromise=null;throw error;});
    return openPromise;
  }
  function read(){
    return open().then(db=>new Promise((resolve,reject)=>{
      if(!db){resolve(null);return;}
      const request=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('IndexedDB read failed'));
    }));
  }
  function putRecord(record){
    return open().then(db=>new Promise((resolve,reject)=>{
      if(!db){resolve(false);return;}
      const request=db.transaction(STORE,'readwrite').objectStore(STORE).put(record);
      request.onsuccess=()=>resolve(true);
      request.onerror=()=>reject(request.error||new Error('IndexedDB write failed'));
    }));
  }
  function write(state){
    const clone=typeof structuredClone==='function'?structuredClone(state):JSON.parse(JSON.stringify(state));
    return putRecord({key:KEY,savedAt:Date.now(),state:clone});
  }
  function writeSerialized(json){return putRecord({key:KEY,savedAt:Date.now(),json:String(json)});}
  function partitionKey(slot,type,id){return'partition:'+slot+':'+type+(id==null?'':':'+id);}
  function nextPartitionSlot(current){return current==='a'?'b':'a';}
  function partitionShell(state){const shell={...state,data:{}};return shell;}
  async function writePartitioned(state,currentSlot,opts={}){
    if(!supported())return false;
    const data=state&&state.data||{},testIds=Object.keys(data),dirtyTestIds=Array.isArray(opts.dirtyTestIds)?[...new Set(opts.dirtyTestIds.map(String))]:null;
    const currentManifest=currentSlot==='a'||currentSlot==='b'?await readKey(partitionKey(currentSlot,'manifest')):null;
    const incremental=!!(currentManifest&&dirtyTestIds),slot=incremental?currentSlot:nextPartitionSlot(currentSlot),slotManifest=incremental?currentManifest:await readKey(partitionKey(slot,'manifest')),savedAt=Math.max(Date.now(),Number(currentManifest&&currentManifest.savedAt||0)+1),shell=partitionShell(state);
    const partitions=incremental?dirtyTestIds.filter(testId=>Object.prototype.hasOwnProperty.call(data,testId)):testIds;
    const removedTestIds=(slotManifest&&Array.isArray(slotManifest.testIds)?slotManifest.testIds:[]).filter(testId=>!testIds.includes(testId));
    await Promise.all([
      putRecord({key:partitionKey(slot,'shell'),savedAt,state:shell}),
      ...partitions.map(testId=>putRecord({key:partitionKey(slot,'data',testId),savedAt,testId,points:data[testId]||[]}))
    ]);
    await putRecord({key:partitionKey(slot,'manifest'),savedAt,slot,testIds});
    await putRecord({key:'partition:latest',savedAt,slot});
    await Promise.all(removedTestIds.map(testId=>deleteKey(partitionKey(slot,'data',testId))));
    return{slot,savedAt,shell,mode:incremental?'incremental':'full',partitionsWritten:partitions.length};
  }
  async function readPartitionSlot(slot){
    if(slot!=='a'&&slot!=='b')return null;
    const manifest=await readKey(partitionKey(slot,'manifest')),shellRecord=await readKey(partitionKey(slot,'shell'));
    if(!manifest||!shellRecord||!shellRecord.state||Number(shellRecord.savedAt||0)>Number(manifest.savedAt||0))return null;
    const testIds=Array.isArray(manifest.testIds)?manifest.testIds:[];
    const rows=await Promise.all(testIds.map(testId=>readKey(partitionKey(slot,'data',testId))));
    if(rows.some(row=>!row||!Array.isArray(row.points)||Number(row.savedAt||0)>Number(manifest.savedAt||0)))return null;
    const data={};testIds.forEach((testId,i)=>{data[testId]=rows[i].points;});
    return{slot,savedAt:manifest.savedAt||0,state:{...shellRecord.state,data}};
  }
  async function readPartitioned(slot){
    if(!supported())return null;
    if(slot)return readPartitionSlot(slot);
    const latest=await readKey('partition:latest'),preferred=latest&&latest.slot;
    return await readPartitionSlot(preferred)||await readPartitionSlot(preferred==='a'?'b':'a');
  }
  function readKey(key){
    return open().then(db=>new Promise((resolve,reject)=>{
      if(!db){resolve(null);return;}
      const request=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||new Error('IndexedDB read failed'));
    }));
  }
  function deleteKey(key){
    return open().then(db=>new Promise((resolve,reject)=>{
      if(!db){resolve(false);return;}
      const request=db.transaction(STORE,'readwrite').objectStore(STORE).delete(key);
      request.onsuccess=()=>resolve(true);
      request.onerror=()=>reject(request.error||new Error('IndexedDB clear failed'));
    }));
  }
  async function clear(){
    if(!supported())return false;
    const manifests=await Promise.all(['a','b'].map(slot=>readKey(partitionKey(slot,'manifest'))));
    const keys=[KEY,'partition:latest'];
    ['a','b'].forEach((slot,i)=>{
      keys.push(partitionKey(slot,'manifest'),partitionKey(slot,'shell'));
      (manifests[i]&&Array.isArray(manifests[i].testIds)?manifests[i].testIds:[]).forEach(testId=>keys.push(partitionKey(slot,'data',testId)));
    });
    await Promise.all(keys.map(deleteKey));return true;
  }
  return{supported,read,write,writeSerialized,writePartitioned,readPartitioned,clear};
})();
