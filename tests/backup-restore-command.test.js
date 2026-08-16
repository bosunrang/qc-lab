const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createBackupRestoreCommand} from './src/application/backup/backup-restore-command.ts';
let state={users:[],activity:[{hash:'old',prevHash:'root',kind:'old'}]},saved=0,rendered=0,cleared=0,logged='';
const command=createBackupRestoreCommand({current:()=>state,replace:value=>{state=value;},normalize:()=>{state.normalized=true;},invariantErrors:()=>[],clearSigmaDraft:()=>cleared++,ensureAdmin:async()=>{state.users=[{id:'admin'}];},setActivity:value=>{state.activity=value;},logImported:name=>{logged=name;state.activity.push({kind:'log'});},save:()=>saved++,render:()=>rendered++});
await command.restore({incoming:{users:[],activity:[{hash:'incoming',prevHash:'root',kind:'import'}]},fileName:'backup.json',oldActivity:[{kind:'before'}]});
console.log(JSON.stringify({state,saved,rendered,cleared,logged}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.equal(value.state.activity[0].kind,'before');
assert.equal(value.state.activity[1].hash,undefined);
assert.equal(value.state.activity[1].prevHash,undefined);
assert.equal(value.state.activity[1].seq,0);
assert.equal(value.state.activity[2].kind,'log');
assert.equal(value.cleared,1);assert.equal(value.saved,1);assert.equal(value.rendered,1);assert.equal(value.logged,'backup.json');
console.log('Backup restore command TypeScript tests passed');
