const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createAdminBootstrapCommand} from './src/application/auth/admin-bootstrap-command.ts';let state={},hashes=0,saves=0,ids=0;const command=createAdminBootstrapCommand({current:()=>state,id:()=>{ids++;return 'admin-id';},hashDefault:async()=>{hashes++;return 'legacy-hash';},createDefault:(id,passHash)=>({id,passHash,username:'admin'}),save:()=>saves++});const created=await command.ensure();const unchanged=await command.ensure();console.log(JSON.stringify({created,unchanged,state,hashes,saves,ids}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.deepEqual(value.created,{created:true,user:{id:'admin-id',passHash:'legacy-hash',username:'admin'}});
assert.deepEqual(value.unchanged,{created:false});assert.deepEqual(value.state,{users:[{id:'admin-id',passHash:'legacy-hash',username:'admin'}]});
assert.deepEqual([value.hashes,value.saves,value.ids],[1,1,1]);
console.log('Admin bootstrap command TypeScript tests passed');
