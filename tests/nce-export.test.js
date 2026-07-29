const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const{loadSandbox,run}=require('./helpers/sandbox');
const root=path.join(__dirname,'..');
const dataIo=fs.readFileSync(path.join(root,'assets/modules/data-io.js'),'utf8');
const workflow=fs.readFileSync(path.join(root,'assets/modules/action-workflow-service.js'),'utf8');

for(const header of [
  'Căn cứ SOP','Quyết định cho phép trở lại','Ngày cho phép','Người cho phép','Căn cứ cho phép',
  'Kết luận hiệu lực','Bằng chứng hiệu lực','RPN còn lại','Căn cứ đánh giá lại',
  'Lý do trả lại','Trạng thái bản ghi','Lý do hủy','Người hủy','Hồ sơ trước','Hồ sơ tiếp theo'
])assert.ok(dataIo.includes(`'${header}'`),`CSV NCE phải có cột "${header}"`);

for(const field of [
  'riskBasis','releaseStatus','releaseDate','releaseBy','releaseNote',
  'effectivenessStatus','effectivenessDate','effectivenessNote','effectivenessBy',
  'residualSeverity','residualOccurrence','residualDetectability','residualRiskLevel','residualRiskBasis',
  'returnNote','returnBy','returnAt','recordStatus','cancelReason','cancelledBy','cancelledAt','parentNceId','followUpNceId'
])assert.match(dataIo,new RegExp(`a\\.${field}\\b`),`CSV NCE phải xuất trường ${field}`);

for(const text of ['Hiệu lực:','Nguy cơ còn lại:','Hồ sơ đã hủy:'])assert.ok(workflow.includes(text),`bản in/XLSX phải có "${text}" trong tóm tắt NCE`);

const ctx=loadSandbox(['modules/data-io.js']);
run(ctx,`
state={lab:{},tests:[],actions:[{nceId:'NCE-XUAT',date:'2026-07-29',riskBasis:'SOP-QC-07',releaseStatus:'released',releaseBy:'Phụ trách khoa',residualSeverity:2,residualOccurrence:1,residualDetectability:1,residualRiskLevel:'low',residualRiskBasis:'Theo dõi sau khắc phục',recordStatus:'cancelled',cancelReason:'Mở nhầm',parentNceId:'NCE-TRUOC',followUpNceId:'NCE-SAU'}]};
ACTION_LABELS={source:{},phase:{},risk:{low:'Thấp'},release:{released:'Đã cho phép trở lại'}};
exportMetaRows=()=>[];vnDate=x=>x||'';formatDateTimeVN=x=>x||'';testDisplayName=t=>t&&t.name||'';actionLevelShort=()=>'';
actionWorkflowStatus=()=>({label:'Đã hủy hồ sơ'});actionRerunStatus=()=>({label:''});actionProtocolSummary=()=>'';actionApprovalLabel=()=>'Đã hủy hồ sơ';actionRiskScore=()=>0;actionResidualRiskScore=()=>2;
downloadCSV=(name,rows)=>{globalThis.__nceCsv={name,rows};};
function __exportNceCsv(){exportActionsCSV();return __nceCsv;}
`);
const out=ctx.__exportNceCsv(),header=Array.from(out.rows[1]),row=Array.from(out.rows[2]),at=name=>row[header.indexOf(name)];
assert.equal(header.length,row.length,'mỗi dòng CSV NCE phải khớp đúng số cột tiêu đề');
assert.equal(at('Căn cứ SOP'),'SOP-QC-07');
assert.equal(at('Người cho phép'),'Phụ trách khoa');
assert.equal(at('RPN còn lại'),2);
assert.equal(at('Lý do hủy'),'Mở nhầm');
assert.equal(at('Hồ sơ trước'),'NCE-TRUOC');
assert.equal(at('Hồ sơ tiếp theo'),'NCE-SAU');

console.log('NCE export traceability tests passed');
