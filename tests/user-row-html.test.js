const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','auth','user-row-html.ts')).href;
const program=`import { createUserRowHtml } from ${JSON.stringify(source)};const render=createUserRowHtml();const esc=value=>'['+value+']';const role=value=>'role:'+value;const btn=(label,action,classes)=>'<button data-action="'+action+'" class="'+classes+'">'+label+'</button>';console.log(render({user:{id:'u1',name:'Lan',username:'lan.nt',initials:'LNT',role:'admin',active:true},currentUserId:'u2',esc,roleLabel:role,btn}));console.log('---');console.log(render({user:{id:'u2',username:'binh',role:'viewer',active:false,current:true},currentUserId:'u2',esc,roleLabel:role,btn}));`;
const result=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr);
const [other,current]=result.stdout.split('---\n');
assert.match(other,/<b>\[Lan\]<\/b>/);
assert.match(other,/role:admin/);
assert.match(other,/data-action="openUserPerms\('u1'\)"/);
assert.match(other,/data-action="toggleUser\('u1'\)"/);
assert.match(other,/data-action="delUser\('u1'\)"/);
assert.match(current,/<span class="tag rej">Khóa<\/span>/);
assert.match(current,/>\(bạn\)<\/span>/);
assert.match(current,/data-action="resetPass\('u2'\)"/);
assert.doesNotMatch(current,/openUserPerms/);
