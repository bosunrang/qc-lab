const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');

const program=`import {createTeaReferenceWorkflowCommand} from './src/application/manage/tea-reference-workflow-command.ts';
let logs=[],saves=[],closed=0,renders=0,reconciled=0;
const log=(...item)=>logs.push(item),saveState=value=>saves.push(value),close=()=>closed++,render=()=>renders++,reconcileSigmaTea=()=>reconciled++,formatDate=iso=>'vn:'+iso;
const service={
  edit:()=>({record:{name:'Glucose',clia:10},before:8,source:{version:'2024'}}),
  restoreOrRemove:()=>({record:{name:'Glucose'},restored:false}),
  addCustomReference:()=>({record:{name:'Test moi',clia:5,ricos:null}}),
  saveLabProfile:()=>({record:{name:'Glucose'},before:null}),
  removeLabProfile:()=>({record:{name:'Glucose'},before:12}),
};
const command=createTeaReferenceWorkflowCommand({current:()=>({}),service,reconcileSigmaTea,formatDate,log,saveState,close,render});
const edited=command.edit({name:'Glucose',field:'clia',val:10});
const removed=command.remove({refKey:'Glucose',isDefault:false});
const restored=command.remove({refKey:'Glucose',isDefault:true});
const added=command.addCustom({data:{name:'Test moi'}});
const savedProfile=command.saveLabProfile({refKey:'Glucose',profile:{value:5,sourceLabel:'Noi bo',reference:'SOP-01',effective:'2026-08-19',approvedDate:'2026-08-18',prepared:'A',approved:'B',nextReview:'',reason:'ly do'}});
const removedProfile=command.removeLabProfile({refKey:'Glucose',isDefault:false});
console.log(JSON.stringify({edited,removed,restored,added,savedProfile,removedProfile,logs,saves,closed,renders,reconciled}));`;
const output=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','--eval',program],{cwd:path.join(__dirname,'..'),encoding:'utf8'});
assert.equal(output.status,0,output.stderr);const value=JSON.parse(output.stdout);

assert.deepEqual(value.logs[0],['Cập nhật TEa tham chiếu','Glucose · CLIA: 8 → 10 · 2024','Bảng TEa']);
assert.deepEqual(value.logs[1],['Xóa TEa tự thêm','Glucose','Bảng TEa']);
assert.deepEqual(value.logs[2],['Khôi phục TEa mặc định','Glucose','Bảng TEa']);
assert.deepEqual(value.logs[3],['Thêm TEa tham chiếu','Test moi · CLIA 5 · Ricos —','Bảng TEa']);
assert.deepEqual(value.logs[4],['Thiết lập TEa chuẩn hóa','Glucose · —% → 5% · Noi bo · SOP-01 · Hiệu lực vn:2026-08-19 · Xây dựng: A · Phê duyệt: B (vn:2026-08-18) · Lý do: ly do','Bảng TEa']);
assert.deepEqual(value.logs[5],['Xóa TEa chuẩn hóa','Glucose · 12%','Bảng TEa']);

assert.equal(value.reconciled,6);
assert.equal(value.saves.length,6);
assert.equal(value.closed,3,'addCustom + saveLabProfile + removeLabProfile phải đóng modal, edit/remove không');
assert.equal(value.renders,6);
console.log('Tea reference workflow command TypeScript tests passed');
