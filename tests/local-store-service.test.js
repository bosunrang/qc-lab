'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','storage','local-store-service.ts')).href;
const program=`import {createLocalStoreService} from ${JSON.stringify(source)};
const rows=new Map(),calls=[];
const service=createLocalStoreService({
 indexedDbAvailable:()=>true,get:key=>Promise.resolve(rows.get(key)||null),put:record=>{rows.set(record.key,record);return Promise.resolve(true)},remove:key=>{rows.delete(key);return Promise.resolve(true)},
 stateRecord:state=>({key:'state',savedAt:1,state}),serializedRecord:json=>({key:'state',savedAt:2,json}),
 writePartitioned:input=>{calls.push({kind:'write',ids:input.dirtyTestIds});return Promise.resolve({slot:'b'})},
 readPartitioned:(slot,get)=>{calls.push({kind:'read',slot});return get('partition:'+String(slot||'latest'))},
 clear:(get,remove)=>get('state').then(()=>remove('state')),
});
await service.write({tests:[]});const before=await service.read();await service.writeSerialized('{"ok":true}');const serialized=await service.read();await service.writePartitioned({},'a',{dirtyTestIds:['T1','T1',2]});rows.set('partition:latest',{slot:'b'});const partition=await service.readPartitioned();const cleared=await service.clear();console.log(JSON.stringify({before,serialized,calls,partition,cleared,left:rows.has('state'),supported:service.supported()}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy local-store service TypeScript');
const output=JSON.parse(result.stdout);
assert.deepEqual(output.before,{key:'state',savedAt:1,state:{tests:[]}});assert.deepEqual(output.serialized,{key:'state',savedAt:2,json:'{"ok":true}'});
assert.deepEqual(output.calls,[{kind:'write',ids:['T1','2']},{kind:'read'}]);assert.deepEqual(output.partition,{slot:'b'});assert.equal(output.cleared,true);assert.equal(output.left,false);assert.equal(output.supported,true);
console.log('LocalStore service TypeScript tests passed');
