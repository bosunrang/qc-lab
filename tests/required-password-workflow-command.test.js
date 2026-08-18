const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createRequiredPasswordWorkflowCommand} from './src/application/auth/required-password-workflow-command.ts';
let logs=[],saves=[];
const log=(...item)=>logs.push(item),saveState=value=>saves.push(value);
const updated=createRequiredPasswordWorkflowCommand({command:{complete:async()=>({status:'updated',user:{id:'u1'}})},log,saveState});
const resultUpdated=await updated.complete({user:{id:'u1'},password:'NewPass123',confirmation:'NewPass123',cloud:true});
const invalid=createRequiredPasswordWorkflowCommand({command:{complete:async()=>({status:'invalid',error:'Mật khẩu quá ngắn.'})},log,saveState});
const resultInvalid=await invalid.complete({user:{id:'u1'},password:'x',confirmation:'y',cloud:true});
console.log(JSON.stringify({resultUpdated,resultInvalid,logs,saves}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.resultUpdated.status,'updated');
assert.equal(value.resultInvalid.status,'invalid');
assert.deepEqual(value.logs,[['Đổi mật khẩu','Người dùng cập nhật mật khẩu','Tài khoản']]);
assert.deepEqual(value.saves,[{cloud:true,clearDerived:false}]);
console.log('Required password workflow command TypeScript tests passed');
