const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const router=read('assets/modules/router-render.js');
const dashboard=read('assets/modules/dashboard-routes.js');
const entry=read('assets/modules/entry-routes.js');
const westgard=read('assets/modules/westgard-routes.js');
const modals=read('assets/modules/modals.js');
const actions=read('assets/modules/actions-routes.js');
const index=read('index.html');

assert.doesNotMatch(router,/function page(?:Dash|Entry|Westgard)\(/,'router-render chỉ giữ điều phối và UI primitives');
assert.match(dashboard,/function pageDash\(/);
assert.match(entry,/function pageEntry\(/);
assert.match(westgard,/function pageWestgard\(/);

const loadOrder=['router-render.js','dashboard-routes.js','entry-routes.js','westgard-routes.js'];
for(let i=1;i<loadOrder.length;i++)assert.ok(index.indexOf(loadOrder[i-1])<index.indexOf(loadOrder[i]),`${loadOrder[i]} phải tải sau ${loadOrder[i-1]}`);

assert.match(modals,/function modalTemplate\(/);
assert.match(modals,/function modalCloseButton\(/);
assert.doesNotMatch(modals,/function (?:syncActLevels|currentIssues|beginActionFromIssue|addAction|cancelAction)\(/,'modals.js không chứa logic trang Actions');
for(const name of ['syncActLevels','currentIssues','beginActionFromIssue','addAction','cancelAction'])assert.match(actions,new RegExp(`function ${name}\\(`));
assert.doesNotMatch(actions,/state\.actions\.splice\(/,'hồ sơ NCE không được xóa vật lý; phải hủy có lưu vết');
assert.match(actions,/recordStatus='cancelled'/,'quy trình hủy phải giữ bản ghi và đánh dấu trạng thái');
assert.doesNotMatch(actions,/function confirmReturnAction\(i\)/,'xác nhận trả lại không được dựa vào vị trí mảng có thể thay đổi khi đồng bộ');
assert.match(actions,/function confirmReturnAction\(id,token\)/,'xác nhận trả lại phải khóa theo ID và token phiên bản');
assert.match(actions,/confirmReturnAction\('\$\{jsq\(current\.id\)\}','\$\{jsq\(token\)\}'\)/,'hộp thoại trả lại phải truyền đúng ID và token của hồ sơ sau xác thực');

/* Form hồ sơ NCE phải render THẲNG từ state qua actionFormModel(): bản cũ đổ giá trị
   vào DOM sau render (populateActionForm trong setTimeout) nên mọi rerender() — đổi
   trang rồi quay lại, hay một bản đồng bộ Firebase dội về — xoá trắng form đang sửa. */
assert.match(actions,/function actionFormModel\(/,'form NCE phải có model render từ state');
assert.doesNotMatch(actions,/function (?:populateActionForm|actionSetField|fillAction)\(/,'không đổ giá trị vào form sau render');
/* Danh tính sự cố bất biến khi sửa: đổi ô "Xét nghiệm" từng làm actionPoint() trả null
   và bỏ luôn yêu cầu QC chạy lại, còn lot bị ghi đè theo lô hiện hành sau mỗi lần chuyển lô. */
assert.match(actions,/editing\?'disabled':'onchange="syncActLevels\(\)"'/,'ô Xét nghiệm phải khoá khi sửa hồ sơ');
assert.match(actions,/const tid=editing\?editing\.testId:/,'addAction\\(\\) không lấy testId từ form khi sửa');
assert.match(actions,/const lot=editing\?\(editing\.lot\|\|''\):/,'lot phải giữ snapshot lúc mở hồ sơ');
/* Lối thoát cho hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng (sửa/xóa/duyệt
   đều bị chặn) — xem actionCanReopen() trong actions-routes.js. */
assert.match(actions,/function actionCanReopen\(/,'phải có đường mở lại hồ sơ duyệt-nhưng-hở');
assert.match(actions,/function confirmApproveAction\(id,token\)/,'xác nhận duyệt phải tìm hồ sơ theo id và khóa phiên bản đã xem');
assert.match(actions,/actionApprovalToken\(a\)!==token/,'phải chặn duyệt nếu hồ sơ hoặc bằng chứng QC đổi khi hộp duyệt đang mở');
assert.doesNotMatch(actions,/!tests\.length\?emptyState\('Cần có xét nghiệm trước'/,'NCE nguồn ngoài IQC phải mở được cả khi chưa có xét nghiệm vận hành');
assert.match(actions,/function actionInvestigationChoose\(/,'checklist điều tra phải dùng lựa chọn trạng thái dạng nút');
assert.match(actions,/class="action-investigation-select"/,'select dữ liệu gốc phải được giữ để tương thích state và kiểm thử');
assert.match(actions,/function actionChecklistChip\(/,'tiêu đề checklist phải hiển thị tiến độ hoàn tất');
assert.match(actions,/function actionSuggestBox\(/,'gợi ý nhập liệu NCE phải dùng cùng một khối thu gọn');
assert.match(actions,/class="action-form-panel-head".*btn\('Quy trình 8 bước'/,'nút quy trình phải nằm cạnh tiêu đề panel lập hồ sơ NCE');
assert.doesNotMatch(actions,/headOnly\([^;\n]+btn\('Quy trình 8 bước'/,'nút quy trình không được chiếm chỗ trên header trang');
assert.match(actions,/cls:'action-guide-modal'/,'hướng dẫn 8 bước phải dùng popup NCE chuyên biệt');
for(const id of ['aContainmentNote','aCorrection','aCause','aAct','aPatientAction','aEffectivenessNote'])assert.match(actions,new RegExp(`actionSuggestBox\\('${id}'`),`${id} phải dùng gợi ý thu gọn`);

assert.match(actions,/const candidate=\{\.\.\.protocol,testId:tid,date,action,by,pointId\}/,'IQC link validation must receive both testId and pointId before opening the record');
for(const id of ['aReleaseStatus','aReleaseDate','aReleaseBy','aReleaseNote'])assert.match(actions,new RegExp(`['"]${id}['"]`),`${id} must remain in the release-decision form`);
assert.match(actions,/actionSuggestBox\('aReleaseNote'/,'release rationale must keep the same editable suggestion pattern');
assert.match(actions,/actionSuggestBox\('aRiskBasis'/,'risk classification must keep an editable SOP-basis field');
assert.match(actions,/actionSuggestBox\('aResidualRiskBasis'/,'residual-risk reassessment must keep an editable evidence field');
for(const id of ['aResidualSeverity','aResidualOccurrence','aResidualDetectability','aResidualRiskLevel','aResidualRiskBasis'])assert.match(actions,new RegExp(`['"]${id}['"]`),`${id} must remain in the effectiveness section`);
assert.match(actions,/function actionEffectivenessMissingKey\(/,'effectiveness validation must focus the exact missing residual-risk field');
assert.match(actions,/\['effectivenessStatus','effectivenessNote','effectivenessDate','residualSeverity','residualOccurrence','residualDetectability','residualRiskLevel','residualRiskBasis'\]\.some/,'changing residual risk must refresh effectiveness reviewer attribution');

console.log('UI route structure tests passed');
