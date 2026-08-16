const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createResetOperationalDataCommand} from './src/application/auth/reset-operational-data-command.ts';
let state={users:[{id:'u1'}],activity:[{id:'a1'}],activityAnchor:'anchor',tests:[{id:'T1'}]},cleared=0,normalized=0,admin=0,logged=0,saved=0,rendered=0;
const command=createResetOperationalDataCommand({current:()=>state,clearPersistence:()=>cleared++,blank:users=>({users,activity:[],activityAnchor:'',tests:[]}),replace:value=>{state=value;},normalize:()=>normalized++,ensureAdmin:async()=>admin++,log:()=>logged++,save:()=>saved++,render:()=>rendered++});
await command.execute();const preserved={users:state.users,activity:state.activity,activityAnchor:state.activityAnchor};state={users:[{id:'u2'}],activity:[{id:'a2'}],activityAnchor:'old',tests:[{id:'T2'}]};await command.execute({keepUsers:false,keepAudit:false,log:false,save:false,render:false});console.log(JSON.stringify({state,preserved,cleared,normalized,admin,logged,saved,rendered}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.deepEqual(value.preserved.users,[{id:'u1'}]);assert.deepEqual(value.preserved.activity,[{id:'a1'}]);assert.equal(value.preserved.activityAnchor,'anchor');assert.deepEqual(value.state.users,[]);assert.deepEqual(value.state.activity,[]);assert.equal(value.state.activityAnchor,'');assert.deepEqual(value.state.tests,[]);
assert.deepEqual([value.cleared,value.normalized,value.admin,value.logged,value.saved,value.rendered],[2,2,2,1,1,1]);
console.log('Reset operational data command TypeScript tests passed');
