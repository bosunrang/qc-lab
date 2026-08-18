const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createUserLifecycleCommand} from './src/application/auth/user-lifecycle-command.ts';let state={},logs=[],saves=0;const manage={add:(items,input)=>{const user={...input,active:true,mustChangePassword:true};items.push(user);return user;},updatePermissions:(user,input)=>Object.assign(user,{role:input.role,pagePerms:input.pagePerms}),resetPassword:(user,hash,mustChange)=>Object.assign(user,{passHash:hash,mustChangePassword:mustChange}),toggle:user=>Object.assign(user,{active:!user.active}),remove:(items,id)=>{const i=items.findIndex(item=>item.id===id);return i<0?undefined:items.splice(i,1)[0];}};const command=createUserLifecycleCommand({current:()=>state,manage,hash:async value=>'hash:'+value,log:(...item)=>logs.push(item),save:()=>saves++});const added=await command.add({id:'u1',username:'user',role:'technician',pagePerms:['dash'],password:'secret',auditDetail:'Kỹ thuật viên'});const updated=command.updatePermissions(added,{role:'reviewer',pagePerms:['report'],auditDetail:'Người duyệt'});const reset=await command.resetPassword(added,'new',false);const toggled=command.toggle(added);const removed=command.remove('u1');console.log(JSON.stringify({added,updated,reset,toggled,removed,state,logs,saves}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.equal(value.added.active,false);assert.equal(value.added.mustChangePassword,false);assert.equal(value.added.passHash,'hash:new');assert.deepEqual(value.state,{users:[]});
assert.deepEqual(value.logs.map(item=>item[0]),['Thêm người dùng','Cập nhật quyền người dùng','Đổi mật khẩu','Khóa người dùng','Xóa người dùng']);assert.equal(value.saves,5);assert.equal(value.removed.username,'user');
console.log('User lifecycle command TypeScript tests passed');
