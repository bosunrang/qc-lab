'use strict';
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=pathToFileURL(path.join(__dirname,'..','src','application','nce','nce-form-command.ts')).href;
const program=`import {createNceFormCommand} from ${JSON.stringify(source)};
let next=0;const records={create:(values)=>{const record={id:'n'+(++next),...values};return record},update:(record,values)=>Object.assign(record,values)};
const command=createNceFormCommand({todayIso:()=> '2026-08-15',draftStatus:r=>r.correction?{complete:true,missing:[],missingKeys:[]}:{complete:false,missing:['xử lý tức thời'],missingKeys:['correction']},effectivenessStatus:()=>({complete:false,label:'Chưa đủ bằng chứng hiệu lực'}),effectivenessMissingKey:()=> 'effectivenessNote',isCancelled:r=>r.recordStatus==='cancelled',approvalStatus:r=>r.approvalStatus||'pending',records});
const actions=[];const base={date:'2026-08-10',dueDate:'2026-08-12',correction:'Đã giữ kết quả',effectivenessStatus:'pending'};
const created=command.submit({actions,values:base,user:{name:'A'}});
const due=command.submit({actions,values:{...base,dueDate:'2026-08-09'},user:{}});
const cancelled=command.submit({actions:[{id:'old',recordStatus:'cancelled'}],editId:'old',values:base,user:{}});
const effective=command.submit({actions,values:{...base,effectivenessStatus:'effective'},user:{}});
console.log(JSON.stringify({created,due,cancelled,effective,length:actions.length}));`;
const result=spawnSync(process.execPath,['--no-warnings','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(result.status,0,result.stderr||'không thể chạy NCE form command TypeScript');
const output=JSON.parse(result.stdout);
// Giai đoạn 7 (state immutable, nhóm actions/NCE, 2026-08-31): submit()/create()
// không còn tự .push() vào mảng actions truyền vào — việc gán lại
// state.actions=[...actions,record] chuyển lên nce-form-workflow-command.ts
// (xem tests/nce-form-workflow-command.test.js), nên actions.length ở đây
// phải giữ nguyên 0 dù đã tạo thành công một record mới.
assert.equal(output.created.ok,true);assert.equal(output.created.mode,'create');assert.equal(output.length,0);
assert.deepEqual([output.due.reason,output.due.missingKey],['due-date','dueDate']);
assert.equal(output.cancelled.reason,'cancelled');assert.deepEqual([output.effective.reason,output.effective.missingKey],['effectiveness','effectivenessNote']);
console.log('NCE form command TypeScript tests passed');
