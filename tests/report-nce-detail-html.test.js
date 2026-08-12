const assert=require('node:assert');
const {spawnSync}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const path=require('node:path');

const source=pathToFileURL(path.join(__dirname,'..','src','presentation','report','report-nce-detail-html.ts')).href;
const model={nceTitle:'N-01',wfLabel:'Mở',eventDateText:'01/01/2026',testLevelText:'Glucose',ruleErrText:'1-3s',sourcePhaseText:'QC',ownerDueText:'Lan',recordStatusText:'Mở',modern:true,containmentText:'Giữ',containmentNote:'Nốt',correctionText:'Sửa',riskText:'Thấp',sodText:'1x1x1',riskBasis:'SOP',checks:[['Thiết bị','Đạt','Đủ']],causeCategoryText:'Máy',actionCompletedText:'02/01',causeText:'Căn nguyên',actionText:'Khắc phục',rerunText:'Đạt',releaseText:'Cho phép',releaseWhoText:'Lan',releaseNote:'Ghi chú',patientText:'Không ảnh hưởng',patientAction:'Không',effLabel:'Hiệu lực',effWhoText:'Lan',effNote:'Bằng chứng',residualText:'Thấp',residualBasis:'SOP',approvalText:'Duyệt',approvalNote:'OK',cancelled:true,cancelText:'Hủy'};
const program=`import { createReportNceDetailHtml } from ${JSON.stringify(source)};const render=createReportNceDetailHtml({model:()=>(${JSON.stringify(model)}),field:(label,value,wide)=>'<field'+(wide?' wide':'')+'>'+label+':'+value+'</field>',escape:value=>'['+value+']'});console.log(render({},{}));`;
const output=spawnSync(process.execPath,['--input-type=module','--experimental-strip-types','--eval',program],{encoding:'utf8'});
assert.equal(output.status,0,output.stderr);
assert.match(output.stdout,/Phiếu NCE \[N-01\]/);
assert.match(output.stdout,/Checklist điều tra/);
assert.match(output.stdout,/\[Thiết bị\]/);
assert.match(output.stdout,/field wide>Ý kiến duyệt:OK/);
assert.match(output.stdout,/Thông tin hủy hồ sơ/);
