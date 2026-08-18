const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createRequiredPasswordCommand} from './src/application/auth/required-password-command.ts';
let hashes=0;const command=createRequiredPasswordCommand({validate:(password,confirmation)=>!password?'Thiếu mật khẩu':password!==confirmation?'Không khớp':'',hash:async password=>{hashes++;return 'hash:'+password;}});const user={passHash:'old',mustChangePassword:true};const invalid=await command.complete({user,password:'mới',confirmation:'khác'});const missing=await command.complete({user:undefined,password:'mới',confirmation:'mới'});const updated=await command.complete({user,password:'mới',confirmation:'mới'});console.log(JSON.stringify({invalid,missing,updated:{status:updated.status,user},hashes}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.deepEqual(value.invalid,{status:'invalid',error:'Không khớp'});
assert.deepEqual(value.missing,{status:'invalid',error:'Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.'});
assert.deepEqual(value.updated,{status:'updated',user:{passHash:'hash:mới',mustChangePassword:false}});
assert.equal(value.hashes,1);
console.log('Required password command TypeScript tests passed');
