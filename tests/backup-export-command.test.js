const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createBackupExportCommand} from './src/application/backup/backup-export-command.ts';
let log=0,save=0,confirmOversized=0,confirm=0,marked=0,updated=0,downloaded=[];
let pack={text:'{}',bytes:50};const command=createBackupExportCommand({current:()=>({id:'state'}),log:()=>log++,save:()=>save++,create:async()=>pack,confirmOversized:async()=>{confirmOversized++;return true;},oversizeDetail:()=>({}),confirm:async()=>{confirm++;return true;},download:(name,text)=>{downloaded.push([name,text]);return true;},mark:()=>marked++,update:()=>updated++});
const full=await command.exportFull('full.json',{},bytes=>bytes===50?{warn:true}:null);const snapshot=await command.snapshot('snapshot.json');pack={text:'x',bytes:60};const cancelled=await createBackupExportCommand({current:()=>({}),log:()=>{},save:()=>{},create:async()=>pack,confirmOversized:async()=>false,confirm:async()=>true,download:()=>true,mark:()=>{},update:()=>{}}).exportFull('cancelled.json',{},()=>null);pack={text:'x',bytes:60};const createError=await createBackupExportCommand({current:()=>({}),log:()=>{},save:()=>{},create:async()=>{throw new Error('hỏng');},confirmOversized:async()=>true,confirm:async()=>true,download:()=>true,mark:()=>{},update:()=>{}}).exportFull('error.json',{},()=>null);
console.log(JSON.stringify({full,snapshot,cancelled,createError:{status:createError.status,message:createError.error?.message},log,save,confirmOversized,confirm,marked,updated,downloaded}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.equal(value.full.status,'done');assert.equal(value.snapshot,true);assert.equal(value.cancelled.status,'cancelled');assert.deepEqual(value.createError,{status:'create-error',message:'hỏng'});assert.deepEqual([value.log,value.save,value.confirmOversized,value.confirm,value.marked,value.updated],[1,1,1,1,2,2]);assert.deepEqual(value.downloaded,[['full.json','{}'],['snapshot.json','{}']]);
console.log('Backup export command TypeScript tests passed');
