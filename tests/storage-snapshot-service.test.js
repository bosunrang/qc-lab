'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','storage','storage-snapshot-service.ts')).href;
const program=`import {createStorageSnapshotService} from ${JSON.stringify(source)};
const events=[];let dirty=false,failures=0,partitioned=false,local=true,mirror=true;
const service=createStorageSnapshotService({
 markChanged:()=>{dirty=true;events.push('changed')},dirty:()=>dirty,cancelScheduled:()=>events.push('cancel'),clearDirty:()=>{dirty=false;events.push('clear')},draftStamp:()=>7,usePartitioned:()=>partitioned,writePartitioned:i=>{events.push(['partition',i]);return true},serialize:()=>{events.push('serialize');return 'snapshot'},writeLocal:(raw,at,quiet)=>{events.push(['local',raw,quiet]);return local},mirror:raw=>{events.push(['mirror',raw]);return mirror},needsCloud:()=>false,clearDraftThrough:stamp=>events.push(['draft',stamp]),resetFailures:()=>{failures=0;events.push('reset')},markDirty:()=>{dirty=true;events.push('dirty')},incrementFailures:()=>{failures++;events.push('failure')},retry:()=>events.push('retry'),markSaved:(a,b)=>events.push(['saved',a,b]),now:()=>42,
});
const idle=service.persist();const legacy=service.persist({changed:true});partitioned=true;const partition=service.persist({changed:true,quiet:true});partitioned=false;local=false;mirror=false;const failure=service.persist({changed:true});console.log(JSON.stringify({idle,legacy,partition,failure,events,dirty,failures}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy storage snapshot service TypeScript');
const output=JSON.parse(result.stdout);
assert.equal(output.idle,false);assert.equal(output.legacy,true);assert.equal(output.partition,true);assert.equal(output.failure,false);assert.equal(output.dirty,true);assert.equal(output.failures,1);
assert.deepEqual(output.events,[
 'changed','cancel','clear','serialize',['local','snapshot',false],['mirror','snapshot'],['draft',7],'reset',
 'changed','cancel','clear',['partition',{quiet:true,draftStamp:7}],
 'changed','cancel','clear','serialize',['local','snapshot',false],['mirror','snapshot'],'dirty','failure','retry'
]);
console.log('Storage snapshot service TypeScript tests passed');
