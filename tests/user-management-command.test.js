const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createUserManagementCommand} from './src/application/auth/user-management-command.ts';
const users=[{id:'admin',username:'admin',active:true}];const command=createUserManagementCommand();
const added=command.add(users,{id:'u1',username:'tech',name:'KTV',initials:'KT',role:'tech',pagePerms:['dash'],passHash:'hash'});const inputPerms=['entry','reports'];
command.updatePermissions(added,{role:'supervisor',pagePerms:inputPerms});inputPerms.push('settings');command.resetPassword(added,'new-hash',false);const afterDisable=command.toggle(added).active;const afterEnable=command.toggle(added).active;
command.setAvatar(added,'data:image/png;base64,abc');const withAvatar=added.avatar;command.clearAvatar(added);const afterClear=added.avatar;
const removed=command.remove(users,'u1');const missing=command.remove(users,'missing');
console.log(JSON.stringify({users,added,afterDisable,afterEnable,withAvatar,afterClear,removed,missing}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
const value=JSON.parse(output.stdout);
assert.deepEqual(value.users,[{id:'admin',username:'admin',active:true}]);
assert.equal(value.added.id,'u1');assert.equal(value.added.username,'tech');assert.equal(value.added.role,'supervisor');assert.deepEqual(value.added.pagePerms,['entry','reports']);assert.equal(value.added.passHash,'new-hash');assert.equal(value.added.mustChangePassword,false);assert.equal(value.afterDisable,false);assert.equal(value.afterEnable,true);assert.equal(value.withAvatar,'data:image/png;base64,abc');assert.equal(value.afterClear,'');assert.equal(value.removed.id,'u1');assert.equal(value.missing,undefined);
console.log('User management command TypeScript tests passed');
