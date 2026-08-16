'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','storage','storage-lifecycle-service.ts')).href;
const program=`import {createStorageLifecycleService} from ${JSON.stringify(source)};
const calls=[];let current=null;
const service=createStorageLifecycleService({
 sanitize:value=>{calls.push(['sanitize',value]);return {...value,sanitized:true}},
 normalize:value=>{calls.push(['normalize',value]);current={...value,normalized:true};return current},
 assertInvariants:value=>{calls.push(['assert',value]);if(!value.ok)throw new Error('invalid')},
 boot:{load:()=>{calls.push('load');return true},loadBootState:async()=>{calls.push('boot');return false}},
 hydrate:async()=>{calls.push('hydrate');return true},restore:async()=>{calls.push('restore');return true},
});
service.adopt({ok:true});let error='';try{service.adopt({ok:false})}catch(e){error=e.message};const result={load:service.load(),boot:await service.loadBootState(),hydrate:await service.hydratePartitioned(),restore:await service.restoreFromIndexedDb(),current,error,calls};console.log(JSON.stringify(result));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy storage lifecycle service TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output.load,true);assert.equal(output.boot,false);assert.equal(output.hydrate,true);assert.equal(output.restore,true);assert.deepEqual(output.current,{ok:false,sanitized:true,normalized:true});assert.equal(output.error,'invalid');
assert.deepEqual(output.calls,[['sanitize',{ok:true}],['normalize',{ok:true,sanitized:true}],['assert',{ok:true,sanitized:true,normalized:true}],['sanitize',{ok:false}],['normalize',{ok:false,sanitized:true}],['assert',{ok:false,sanitized:true,normalized:true}],'load','boot','hydrate','restore']);
console.log('Storage lifecycle service TypeScript tests passed');
