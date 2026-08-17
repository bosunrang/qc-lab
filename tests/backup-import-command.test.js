const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createBackupImportCommand} from './src/application/backup/backup-import-command.ts';
let prepared='',snapshots=[],restored=[];const command=createBackupImportCommand({prepare:async text=>{prepared=text;return{id:'incoming'};},sizeWarning:bytes=>bytes>9?'warn':'',snapshot:async prefix=>{snapshots.push(prefix);return true;},restore:async input=>restored.push(input)});
const accepted=await command.importFile({fileName:'backup.json',size:10,text:'payload',oldActivity:[{id:'old'}],confirmOversized:async()=>true,confirmImport:async input=>input.name==='backup.json'&&input.sizeWarning==='warn',reauthenticate:async()=>true,snapshotFailureMessage:'snapshot failed'});
const cancelled=await command.importFile({fileName:'cancel.json',size:1,text:'nope',oldActivity:[],confirmOversized:async()=>false,confirmImport:async()=>true,reauthenticate:async()=>true,snapshotFailureMessage:'snapshot failed'});
console.log(JSON.stringify({accepted,cancelled,prepared,snapshots,restored}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.equal(value.accepted.status,'imported');assert.equal(value.cancelled.status,'cancelled');assert.equal(value.prepared,'payload');assert.deepEqual(value.snapshots,['truoc-nhap']);assert.deepEqual(value.restored,[{incoming:{id:'incoming'},fileName:'backup.json',oldActivity:[{id:'old'}]}]);
console.log('Backup import command TypeScript tests passed');
