const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createBackupInspectionCommand} from './src/application/backup/backup-inspection-command.ts';
let seen=[];const command=createBackupInspectionCommand({inspect:async(text,bytes)=>{seen=[text,bytes];return{ok:true};}});
const inspected=await command.inspectFile({text:'payload',size:12,confirmOversized:async()=>true});const cancelled=await command.inspectFile({text:'skip',size:1,confirmOversized:async()=>false});console.log(JSON.stringify({inspected,cancelled,seen}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.deepEqual(value.inspected,{status:'inspected',report:{ok:true}});assert.deepEqual(value.cancelled,{status:'cancelled'});assert.deepEqual(value.seen,['payload',12]);
console.log('Backup inspection command TypeScript tests passed');
