const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const{loadSandbox,run}=require('./helpers/sandbox');

// data-io.js giữ tầng dữ liệu dùng chung (reportNceModel/reportNceSummaryParts/
// reportNceExcerpt) mà cả bản in lẫn bản Excel cùng đọc; nạp đúng thứ tự index.html.
const ctx=loadSandbox(['modules/data-io.js','modules/reports.js'],{window:{QCLAB_APP:{name:'QC Lab',version:'test'}}});
run(ctx,`
  ACTION_LABELS={
    cause:{instrument:'Thiết bị'},source:{iqc:'Nội kiểm IQC'},phase:{exam:'Xét nghiệm'},risk:{high:'Cao',low:'Thấp'},
    containment:{held:'Giữ kết quả liên quan'},patient:{none:'Không ảnh hưởng'},release:{released:'Đã cho phép trở lại'},
    check:{ok:'Đạt',abnormal:'Bất thường'}
  };
  function testDisplayName(t){return t.name;}
  function actionLevelShort(t,level,lot){return 'M'+level+' - Lô '+lot;}
  function actionRerunStatus(){return{label:'QC đạt lại',point:{val:140.2,date:'2026-07-17',runId:'R2'}};}
  function actionWorkflowStatus(){return{label:'Đã khép vòng'};}
  function actionEffectivenessStatus(){return{label:'Có hiệu lực'};}
  function actionRiskScore(){return 60;}
  function actionResidualRiskScore(){return 8;}
  function actionEventDate(a){return a.date;}
  function actionApprovalLabel(){return 'Đã duyệt';}
  function vnDate(v){return v;}
  function formatDateTimeVN(v){return v;}
  function fmt(v){return String(v);}
  var reportTest={id:'T1',name:'Sodium (Na)',unit:'mmol/L'};
  var reportAction={protocolVersion:3,nceId:'NCE-20260729-DIG4',testId:'T1',date:'2026-07-17',level:1,lot:'1101',rule:'1-3s',errorType:'Sai số ngẫu nhiên',eventSource:'iqc',processPhase:'exam',by:'Quản trị viên',dueDate:'2026-07-24',containmentStatus:'held',containmentNote:'Giữ kết quả từ 08:00',correction:'Vệ sinh kim hút, loại bọt khí',riskLevel:'high',riskSeverity:4,riskOccurrence:3,riskDetectability:5,riskBasis:'SOP-QC-07',qcMaterialStatus:'ok',qcMaterialNote:'Đạt',instrumentStatus:'abnormal',instrumentNote:'Kim hút có bọt khí',reagentStatus:'ok',reagentNote:'Đạt',calibrationStatus:'ok',calibrationNote:'Đạt',lotToLotStatus:'ok',lotToLotNote:'Không cần',causeCategory:'instrument',cause:'Bọt khí tại kim hút',action:'Vệ sinh kim hút và kiểm tra lại đường ống',actionCompletedDate:'2026-07-17',releaseStatus:'released',releaseDate:'2026-07-17',releaseBy:'Phụ trách khoa',releaseNote:'QC chạy lại được chấp nhận',patientImpact:'none',patientAction:'Không có kết quả cần thu hồi',effectivenessStatus:'effective',effectivenessDate:'2026-07-29',effectivenessBy:'Quản trị viên',effectivenessNote:'Không tái diễn trong 10 lần chạy',residualRiskLevel:'low',residualSeverity:2,residualOccurrence:2,residualDetectability:2,residualRiskBasis:'Theo dõi sau CAPA',approvalStatus:'approved',approvedBy:'Trưởng khoa',approvedAt:'2026-07-29T10:00:00Z',approvalNote:'Đủ bằng chứng'};
`);

const excerpt=run(ctx,"reportNceExcerpt('Một nội dung rất dài cần được rút gọn để bảng tổng hợp vẫn dễ đọc',30)");
assert.ok(excerpt.length<=30&&excerpt.endsWith('…'),'tóm tắt phải có giới hạn và chỉ báo đã rút gọn');

const summary=run(ctx,'reportNceSummaryHtml(reportAction)');
assert.match(summary,/Tức thời:/);
assert.match(summary,/Nguyên nhân:/);
assert.match(summary,/Khắc phục:/);
assert.doesNotMatch(summary,/SOP-QC-07/,'bảng chính không nhét toàn bộ protocol NCE');

const detail=run(ctx,'reportNceDetailHtml(reportAction,reportTest)');
for(const label of ['Phiếu NCE NCE-20260729-DIG4','Kiểm soát và xử lý tức thời','Đánh giá nguy cơ ban đầu','Checklist điều tra','Nguyên nhân và hành động khắc phục','Bằng chứng QC chạy lại','Ảnh hưởng người bệnh','Hiệu lực, nguy cơ còn lại và phê duyệt'])assert.match(detail,new RegExp(label));
for(const evidence of ['SOP-QC-07','Kim hút có bọt khí','QC chạy lại được chấp nhận','Không tái diễn trong 10 lần chạy','Đủ bằng chứng'])assert.match(detail,new RegExp(evidence));
assert.match(detail,/Căn cứ SOP<\/span><b>SOP-QC-07[^<]*<\/b><\/div>/,'căn cứ SOP phải nằm trong một ô riêng');
assert.equal((detail.match(/class="nce-detail-wide"/g)||[]).length,2,'hai hàng lẻ phải trải hết chiều ngang thay vì để trống nửa hàng');
assert.match(detail,/<colgroup><col style="width:30%"><col style="width:22%"><col style="width:48%"><\/colgroup>/,'checklist phải khóa tỷ lệ ba cột');

const appendix=run(ctx,'reportNceAppendixHtml([reportAction],reportTest)');
assert.match(appendix,/Phụ lục - Hồ sơ NCE chi tiết/);
assert.equal((appendix.match(/class="nce-detail"/g)||[]).length,1);

/* Bản in và bản Excel phải cùng đọc reportNceModel(). Nếu ai thêm một trường vào
   model cho bản Excel mà quên dựng nó ở bản in, vòng lặp dưới đây fail — đó chính
   là lỗi mà hai bản chép tay trước 2026-08-01 không có gì bắt được.
   legacyActionText và approvalShortText chỉ dùng cho hồ sơ protocol v1,
   cancelText chỉ xuất hiện khi hồ sơ bị hủy — nên loại khỏi phép đối chiếu. */
const model=run(ctx,'reportNceModel(reportAction,reportTest)');
const legacyOnly=new Set(['legacyActionText','approvalShortText','cancelText','modern','cancelled','checks']);
const rendered=Object.entries(model).filter(([key,value])=>!legacyOnly.has(key)&&typeof value==='string'&&value!=='—');
assert.ok(rendered.length>=20,'model phải mang đủ nội dung phiếu NCE, đang có '+rendered.length+' trường');
for(const[key,value]of rendered)assert.ok(detail.includes(value),`bản in bỏ sót trường "${key}" của reportNceModel: ${value}`);
for(const[,statusText,noteText]of model.checks){assert.ok(detail.includes(statusText));assert.ok(detail.includes(noteText));}

const routeSource=fs.readFileSync(path.join(__dirname,'..','assets','modules','report-routes.js'),'utf8');
const reportSource=fs.readFileSync(path.join(__dirname,'..','assets','modules','reports.js'),'utf8');
assert.match(routeSource,/id="reportNceAppendix"[^>]*checked/,'trang báo cáo phải có tùy chọn phụ lục bật sẵn');
assert.match(reportSource,/acts\.length&&includeNceAppendix/,'phụ lục chỉ được thêm khi có NCE và người dùng bật tùy chọn');
assert.match(reportSource,/\.nce-detail-stack\{display:grid;gap:7px;break-inside:avoid\}/,'mục 1 và 4 phải có khoảng lưới 7px và không bị tách hai hàng qua trang');
assert.equal((detail.match(/class="nce-detail-stack"/g)||[]).length,2,'mục 1 và 4 phải dùng cùng cấu trúc khoảng cách');

console.log('Report NCE print tests passed');
