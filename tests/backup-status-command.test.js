const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createBackupStatusCommand} from './src/application/backup/backup-status-command.ts';
let raw=0,bytes=0;const command=createBackupStatusCommand({reminder:{lastBackupInfo:value=>({value}),statusText:(cloud,info)=>cloud?'cloud-'+info.value:'local-'+info.value,capacityText:(value,max,size,warning)=>value+'/'+max+'/'+size(value)+'/'+warning(value),overdue:(cloud,info,days)=>!cloud&&info.value==='old'&&days===7,banner:(cloud,user,info,days)=>({cloud,user,info,days})},marker:{lastRaw:()=>{raw++;return'old';},bytes:()=>{bytes++;return 12;}},maxBytes:100,size:value=>'S'+value,warning:value=>'W'+value});
console.log(JSON.stringify({status:command.status(false),capacity:command.capacity(),overdue:command.overdue(false,7),banner:command.banner({cloudReady:true,user:{id:'u'},days:3}),raw,bytes}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.status,'local-old');assert.equal(value.capacity,'12/100/S12/W12');assert.equal(value.overdue,true);assert.deepEqual(value.banner,{cloud:true,user:{id:'u'},info:{value:'old'},days:3});assert.equal(value.raw,3);assert.equal(value.bytes,1);
console.log('Backup status command TypeScript tests passed');
