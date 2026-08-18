const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createLoginWorkflowCommand} from './src/application/auth/login-workflow-command.ts';
let logs=[],saves=[];
const log=(...item)=>logs.push(item),saveState=value=>saves.push(value);
const authenticated=createLoginWorkflowCommand({login:{authenticate:async()=>({status:'authenticated',lock:{fails:0,until:0},user:{id:'u1'},upgradedPassword:true})},log,saveState});
const resultAuthenticated=await authenticated.authenticate({users:[],username:'admin',password:'x',lock:{fails:0,until:0},now:1});
const failed=createLoginWorkflowCommand({login:{authenticate:async()=>({status:'failed',lock:{fails:1,until:0},reason:'invalid-password'})},log,saveState});
const resultFailed=await failed.authenticate({users:[],username:'admin',password:'x',lock:{fails:0,until:0},now:1});
const verificationError=createLoginWorkflowCommand({login:{authenticate:async()=>({status:'failed',lock:{fails:0,until:0},reason:'verification-error'})},log,saveState});
const resultVerificationError=await verificationError.authenticate({users:[],username:'admin',password:'x',lock:{fails:0,until:0},now:1});
const locked=createLoginWorkflowCommand({login:{authenticate:async()=>({status:'locked',lock:{fails:3,until:99},message:'locked'})},log,saveState});
const resultLocked=await locked.authenticate({users:[],username:'admin',password:'x',lock:{fails:3,until:99},now:1});
authenticated.logout();
console.log(JSON.stringify({resultAuthenticated,resultFailed,resultVerificationError,resultLocked,logs,saves}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);
assert.equal(value.resultAuthenticated.status,'authenticated');
assert.equal(value.resultFailed.status,'failed');
assert.equal(value.resultVerificationError.status,'failed');
assert.equal(value.resultLocked.status,'locked');
assert.deepEqual(value.logs,[
  ['Đăng nhập','Đăng nhập thành công','Tài khoản'],
  ['Nâng cấp mật khẩu','Tự động băm lại theo chuẩn mới khi đăng nhập','Tài khoản'],
  ['Đăng nhập thất bại','Sai mật khẩu','admin'],
  ['Đăng xuất','Đăng xuất khỏi phần mềm','Tài khoản'],
]);
assert.equal(value.saves.length,3);
console.log('Login workflow command TypeScript tests passed');
