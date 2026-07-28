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
assert.doesNotMatch(modals,/function (?:syncActLevels|currentIssues|beginActionFromIssue|addAction|delAction)\(/,'modals.js không chứa logic trang Actions');
for(const name of ['syncActLevels','currentIssues','beginActionFromIssue','addAction','delAction'])assert.match(actions,new RegExp(`function ${name}\\(`));

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

console.log('UI route structure tests passed');
