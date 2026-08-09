const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const QCCore=require('../assets/core.js');

const router=read('assets/modules/router-render.js');
const dashboard=read('assets/modules/dashboard-routes.js');
const entry=read('assets/modules/entry-routes.js');
const westgard=read('assets/modules/westgard-routes.js');
const modals=read('assets/modules/modals.js');
const actions=read('assets/modules/actions-routes.js');
const form=read('assets/modules/action-form.js');
const actionRecordService=read('src/application/nce/action-record-service.ts');
const actionEvidencePresentation=read('src/presentation/nce/action-evidence-presentation.ts');
const report=read('assets/modules/report-routes.js');
const sigma=read('assets/modules/sigma.js');
const sigmaTea=read('assets/modules/sigma-tea.js');
const reportsCss=read('assets/professional-reports.css');
const index=read('index.html');
/* Vài quy ước là "không được xuất hiện Ở BẤT KỲ ĐÂU trong trang Khắc phục sự cố"
   (xóa vật lý hồ sơ, đổ giá trị vào form sau render...). Sau khi tách file, chỉ soi
   một trong hai file sẽ để lọt — nên các quy ước đó soi trên phần nối. */
const actionsArea=actions+'\n'+form;
assert.doesNotMatch(sigma,/✓\s*Áp dụng (?:Bias%|ngân sách MU)/,'nút áp dụng Bias và MU không dùng dấu tick trang trí');

/* CSP là một hợp đồng bảo mật nhưng HTML sai thuộc tính vẫn render bình thường, nên
   browser smoke/a11y không tự báo. Chốt đúng một thẻ meta hợp lệ để cache-buster hoặc
   thao tác thay chuỗi không thể vô tình chèn vào giữa `http-equiv` lần nữa. */
const cspTags=index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]+">/g)||[];
assert.equal(cspTags.length,1,'index.html phải có đúng một thẻ CSP hợp lệ');
assert.match(cspTags[0],/object-src 'none'/,'CSP phải tiếp tục chặn object nhúng');
assert.doesNotMatch(index,/http-equi\?+/,'thuộc tính http-equiv không được bị hỏng bởi chuỗi cache version');

assert.doesNotMatch(router,/function page(?:Dash|Entry|Westgard)\(/,'router-render chỉ giữ điều phối và UI primitives');
assert.match(dashboard,/function pageDash\(/);
assert.match(entry,/function pageEntry\(/);
assert.match(westgard,/function pageWestgard\(/);

const loadOrder=['router-render.js','dashboard-routes.js','entry-routes.js','westgard-routes.js'];
for(let i=1;i<loadOrder.length;i++)assert.ok(index.indexOf(loadOrder[i-1])<index.indexOf(loadOrder[i]),`${loadOrder[i]} phải tải sau ${loadOrder[i-1]}`);

/* core.js không thể require router-render.js (nó phải chạy độc lập trong Node/test, và
   tải trước mọi module khác trong trang), nên PAGE_SET/ROLE_SET ở đó và PAGE_DEFS/ROLE_LIST
   ở router-render.js buộc phải là hai khai báo tách rời — không thể gộp thành một nguồn thật
   như WG_RULE_REGISTRY. Test này là lưới an toàn thay thế: nếu ai thêm/xoá một trang hoặc một
   vai trò mà chỉ sửa một bên, test đối chiếu tập hợp sẽ trượt ngay thay vì âm thầm lệch (đúng
   kiểu lỗi từng xảy ra với bảng luật Westgard trong worker trước 2026-08-01). */
const pageDefsMatch=router.match(/const PAGE_DEFS=\[([\s\S]*?)\];/);
assert.ok(pageDefsMatch,'router-render.js phải khai báo PAGE_DEFS');
const routerPageIds=[...pageDefsMatch[1].matchAll(/\['([a-z]+)','[^']*',\[/g)].map(m=>m[1]);
assert.deepStrictEqual(new Set(routerPageIds),QCCore.PAGE_SET,'Tập id trang ở PAGE_DEFS (router-render.js) phải khớp PAGE_SET (core.js) — sanitizeBackup() lọc pagePerms theo PAGE_SET, lệch tập là mất quyền âm thầm khi nhập backup');
const roleListMatch=router.match(/const ROLE_LIST=\[([\s\S]*?)\];/);
assert.ok(roleListMatch,'router-render.js phải khai báo ROLE_LIST');
const routerRoles=[...roleListMatch[1].matchAll(/'([a-z]+)'/g)].map(m=>m[1]);
assert.deepStrictEqual(new Set(routerRoles),QCCore.ROLE_SET,'ROLE_LIST (router-render.js) phải khớp ROLE_SET (core.js)');

/* Trang Báo cáo tách khỏi actions-routes.js (2026-07-30) vì file đó từng giữ CẢ hai
   trang và phình lên 105 KB — cùng lý do đã tách dash/entry/westgard khỏi
   router-render.js. Chốt cả hai chiều: mỗi trang nằm đúng file của nó VÀ không có
   tham chiếu chéo nào lẻn ngược lại, nếu không lần gộp sau sẽ âm thầm tái diễn. */
assert.match(report,/function pageReportV2\(/,'trang Báo cáo phải nằm ở report-routes.js');
assert.doesNotMatch(actions,/function pageReportV2\(/,'actions-routes.js không được giữ lại trang Báo cáo');
assert.ok(index.indexOf('actions-routes.js')<index.indexOf('report-routes.js'),'report-routes.js phải tải sau actions-routes.js');
for(const name of ['reportLockPanelHtml','reportRangePicker','reportDateRange','reportRangeText','reportApplySearch'])assert.match(report,new RegExp(`function ${name}\\(`),`${name} thuộc trang Báo cáo`);
assert.match(report,/^let reportQ=/m,'state của trang Báo cáo đi cùng trang, không bỏ lại actions-routes.js');
assert.doesNotMatch(actions,/\breport[A-Z_]/,'actions-routes.js không còn tham chiếu nào tới trang Báo cáo');
assert.doesNotMatch(report,/\bpageActionsV4\b|\bACT_[A-Z]/,'report-routes.js không được kéo theo logic trang Khắc phục sự cố');
assert.doesNotMatch(actions,/===== ACTIONS & REPORT PAGE ROUTES =====/,'tiêu đề file phải theo kịp việc tách trang');

/* Lớp giải TEa tách khỏi sigma.js (2026-08-01) sau khi bản đồ độ phủ
   (`npm run coverage-map`) chỉ ra sigma.js 85 KB chỉ chạy 34,4% và 51 hàm chưa
   test nào chạm tới — phần lớn điểm mù nằm ở đúng lớp THUẦN này. Cắt một chiều:
   sigma.js gọi sang sigma-tea.js, chiều ngược lại phải TRỐNG, nếu không lớp này
   hết test được bằng Node. Test riêng: tests/sigma-tea.test.js. */
for(const name of ['effectiveTeaRefs','sgRef','sgTeaInfo','sgTeaSource','sgTeaSnapshot','sgSetLevelTeaSnapshot','sgEntryTea','sgCliaCriterion','sgUnitsMatch','teaRefRecordForName'])assert.match(sigmaTea,new RegExp(`function ${name}\\(`),`${name} thuộc lớp giải TEa`);
assert.match(sigmaTea,/^const SG_TEA_SOURCES=/m,'danh mục nguồn TEa đi cùng lớp giải TEa');
assert.doesNotMatch(sigma,/function (?:effectiveTeaRefs|sgRef|sgTeaInfo|sgTeaSnapshot|sgCliaCriterion)\(/,'sigma.js không được giữ lại lớp giải TEa');
assert.doesNotMatch(sigmaTea,/function (?:pageSigma|sgComp|sgMU|sgRefresh|sgOpenMU|sgOpenBias)\(/,'sigma-tea.js không được kéo theo trang Sigma, MU hay modal');
assert.doesNotMatch(sigmaTea,/document\.|openModal\(|rerender\(/,'sigma-tea.js phải thuần — chạm DOM là hết test bằng Node');
assert.ok(index.indexOf('sigma-tea.js')<index.indexOf('sigma.js?'),'sigma-tea.js phải tải trước sigma.js');

assert.match(modals,/function modalTemplate\(/);
assert.match(modals,/function modalCloseButton\(/);
assert.doesNotMatch(modals,/function (?:syncActLevels|currentIssues|beginActionFromIssue|addAction|cancelAction)\(/,'modals.js không chứa logic trang Actions');
/* Form NCE tách khỏi actions-routes.js (2026-07-30) sau khi trang Báo cáo ra riêng mà
   file vẫn còn 94 KB — phần lớn là form 8 mục nằm gọn trong MỘT hàm pageActionsV4() 17 KB.
   Đường cắt này cố ý KHÔNG một chiều (khác report-routes.js): form gọi ngược các khối
   dựng bằng chứng của trang, trang gọi vào form để mở/lưu hồ sơ. Vì vậy test chốt theo
   TRÁCH NHIỆM — hàm nào ở file nào — chứ không đòi đồ thị phụ thuộc không chu trình. */
for(const name of ['currentIssues','cancelAction','viewActionDetail','openActionGuide'])assert.match(actions,new RegExp(`function ${name}\\(`),`${name} thuộc phần trang/vòng đời`);
for(const name of ['syncActLevels','beginActionFromIssue','addAction','actionFormHtml','actionFormModel','actionSection','actionSuggestBox','actionInvestigationField','readActionProtocolForm'])assert.match(form,new RegExp(`function ${name}\\(`),`${name} thuộc form NCE`);
assert.doesNotMatch(actions,/function actionFormModel\(|\bACT_SUGGEST\b\s*=/,'actions-routes.js không được giữ lại phần dựng form');
assert.doesNotMatch(form,/function (?:pageActionsV4|currentIssues|approveAction|viewActionDetail)\(/,'action-form.js không được kéo theo trang và vòng đời hồ sơ');
assert.ok(index.indexOf('actions-routes.js')<index.indexOf('action-form.js'),'action-form.js phải tải sau actions-routes.js');
/* pageActionsV4() từng dựng cả form 8 mục trong chính nó; giờ phải gọi sang actionFormHtml()
   và chỉ truyền số sự cố — nếu nó tự currentIssues() lần nữa thì danh sách trên màn hình và
   con số trong khung "chưa chọn sự cố" có thể lệch nhau. */
assert.match(actions,/actionFormHtml\(issues\.length\)/,'trang phải dùng lại đúng tập sự cố đã tính cho panel form');
assert.doesNotMatch(actions,/class="action-form-body"/,'markup form không được ở lại actions-routes.js');
assert.doesNotMatch(actionsArea,/state\.actions\.splice\(/,'hồ sơ NCE không được xóa vật lý; phải hủy có lưu vết');
assert.match(actions,/ActionReviewService\.cancel\(/,'quy trình hủy phải gọi command hủy mềm');
assert.doesNotMatch(actions,/function confirmReturnAction\(i\)/,'xác nhận trả lại không được dựa vào vị trí mảng có thể thay đổi khi đồng bộ');
assert.match(actions,/function confirmReturnAction\(id,token\)/,'xác nhận trả lại phải khóa theo ID và token phiên bản');
assert.match(actions,/confirmReturnAction\('\$\{jsq\(current\.id\)\}','\$\{jsq\(token\)\}'\)/,'hộp thoại trả lại phải truyền đúng ID và token của hồ sơ sau xác thực');

/* Form hồ sơ NCE phải render THẲNG từ state qua actionFormModel(): bản cũ đổ giá trị
   vào DOM sau render (populateActionForm trong setTimeout) nên mọi rerender() — đổi
   trang rồi quay lại, hay một bản đồng bộ Firebase dội về — xoá trắng form đang sửa. */
assert.match(form,/function actionFormModel\(/,'form NCE phải có model render từ state');
assert.doesNotMatch(actionsArea,/function (?:populateActionForm|actionSetField|fillAction)\(/,'không đổ giá trị vào form sau render');
/* Danh tính sự cố bất biến khi sửa: đổi ô "Xét nghiệm" từng làm actionPoint() trả null
   và bỏ luôn yêu cầu QC chạy lại, còn lot bị ghi đè theo lô hiện hành sau mỗi lần chuyển lô. */
assert.match(form,/editing\?'disabled':'onchange="syncActLevels\(\)"'/,'ô Xét nghiệm phải khoá khi sửa hồ sơ');
assert.match(form,/const tid=editing\?editing\.testId:/,'addAction\\(\\) không lấy testId từ form khi sửa');
assert.match(form,/const lot=editing\?\(editing\.lot\|\|''\):/,'lot phải giữ snapshot lúc mở hồ sơ');
/* Lối thoát cho hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng (sửa/xóa/duyệt
   đều bị chặn) — xem actionCanReopen() trong actions-routes.js. */
assert.match(actions,/function actionCanReopen\(/,'phải có đường mở lại hồ sơ duyệt-nhưng-hở');
assert.match(actions,/function confirmApproveAction\(id,token\)/,'xác nhận duyệt phải tìm hồ sơ theo id và khóa phiên bản đã xem');
assert.match(actions,/actionApprovalToken\(a\)!==token/,'phải chặn duyệt nếu hồ sơ hoặc bằng chứng QC đổi khi hộp duyệt đang mở');
assert.doesNotMatch(actionsArea,/!tests\.length\?emptyState\('Cần có xét nghiệm trước'/,'NCE nguồn ngoài IQC phải mở được cả khi chưa có xét nghiệm vận hành');
assert.match(form,/function actionInvestigationChoose\(/,'checklist điều tra phải dùng lựa chọn trạng thái dạng nút');
assert.match(form,/class="action-investigation-select"/,'select dữ liệu gốc phải được giữ để tương thích state và kiểm thử');
assert.match(form,/function actionChecklistChip\(/,'tiêu đề checklist phải hiển thị tiến độ hoàn tất');
assert.match(form,/function actionSuggestBox\(/,'gợi ý nhập liệu NCE phải dùng cùng một khối thu gọn');
assert.match(form,/class="action-form-panel-head".*btn\('Quy trình 8 bước'/,'nút quy trình phải nằm cạnh tiêu đề panel lập hồ sơ NCE');
assert.match(reportsCss,/\.action-form-panel-head\{[^}]*justify-content:space-between/,'header lập hồ sơ NCE phải tách tiêu đề trái và nút quy trình sang phải');
assert.match(reportsCss,/\.action-form-panel-head\{[^}]*color:var\(--card-head-ink\);[^}]*font-size:var\(--section-head-size\);[^}]*font-weight:800/,'header lập hồ sơ NCE phải dùng đúng token chữ của header panel hệ thống');
assert.match(reportsCss,/\.action-form-panel \.action-form-panel-head > \.panel-title\{[^}]*flex:1;[^}]*color:inherit;[^}]*font:inherit/,'tiêu đề lập hồ sơ NCE phải kế thừa nguyên kiểu chữ hệ thống từ header');
assert.doesNotMatch(actionsArea,/headOnly\([^;\n]+btn\('Quy trình 8 bước'/,'nút quy trình không được chiếm chỗ trên header trang');
assert.match(actions,/cls:'action-guide-modal'/,'hướng dẫn 8 bước phải dùng popup NCE chuyên biệt');
assert.match(actions,/class="alert warn action-cancel-warning"/,'cảnh báo hủy NCE phải có bố cục riêng để nội dung không bị ép thành hai cột');
assert.match(reportsCss,/\.action-cancel-warning\{[^}]*width:100%;[^}]*flex-direction:column/,'cảnh báo hủy NCE phải xếp câu chính và giải thích theo chiều dọc');
assert.match(report,/class="report-export-options"[\s\S]*?Kèm phụ lục NCE[\s\S]*?\(Áp dụng cho PDF và Excel\)[\s\S]*?class="report-actions"/,'tùy chọn phụ lục NCE phải nằm ở dòng riêng phía trên các nút xuất và có chú thích trong ngoặc');
assert.match(reportsCss,/\.report-nce-option span\{[^}]*display:inline-flex;[^}]*align-items:baseline;[^}]*white-space:nowrap/,'nhãn và chú thích phụ lục NCE phải nằm cùng hàng');
assert.match(reportsCss,/\.report-nce-option\{[^}]*align-items:center/,'ô tick phải căn giữa theo chiều dọc với nhãn phụ lục NCE');
assert.match(reportsCss,/\.report-nce-option input\{[^}]*margin:0/,'ô tick phụ lục NCE không được giữ độ lệch thủ công');
assert.match(reportsCss,/@media\(max-width:760px\)\{[\s\S]*?\.report-nce-option span\{[^}]*white-space:normal;[^}]*flex-wrap:wrap/,'nhãn phụ lục NCE được phép xuống hàng trên màn hình hẹp');
assert.doesNotMatch(report,/class="report-actions"[\s\S]*?report-nce-option/,'checkbox phụ lục NCE không được trộn cùng hàng nút hành động');
assert.doesNotMatch(actions,/action-guide-(?:mark|legend)/,'hướng dẫn NCE không được dùng logo phụ hoặc dải màu phân nhóm');
assert.match(reportsCss,/\.action-guide-list\{[^}]*grid-template-columns:1fr/,'quy trình NCE phải là một danh sách tuyến tính dễ đọc');
assert.match(reportsCss,/\.action-guide-card\{[^}]*border-bottom:1px solid var\(--line\)/,'các bước NCE chỉ phân cách bằng đường kẻ trung tính, không dùng card màu');
for(const id of ['aContainmentNote','aCorrection','aCause','aAct','aPatientAction','aEffectivenessNote'])assert.match(form,new RegExp(`actionSuggestBox\\('${id}'`),`${id} phải dùng gợi ý thu gọn`);

assert.match(form,/const candidate=\{\.\.\.\(editing\|\|\{\}\),\.\.\.protocol,testId:tid,level,lot,pointId,date,action,by\}/,'candidate khi sửa phải giữ nguồn tạo và toàn bộ danh tính IQC trước khi kiểm tra cổng chạy lại');
for(const id of ['aReleaseStatus','aReleaseDate','aReleaseBy','aReleaseNote'])assert.match(form,new RegExp(`['"]${id}['"]`),`${id} must remain in the release-decision form`);
assert.match(form,/actionSuggestBox\('aReleaseNote'/,'release rationale must keep the same editable suggestion pattern');
assert.match(form,/actionSuggestBox\('aRiskBasis'/,'risk classification must keep an editable SOP-basis field');
assert.match(form,/actionSuggestBox\('aResidualRiskBasis'/,'residual-risk reassessment must keep an editable evidence field');
for(const id of ['aResidualSeverity','aResidualOccurrence','aResidualDetectability','aResidualRiskLevel','aResidualRiskBasis'])assert.match(form,new RegExp(`['"]${id}['"]`),`${id} must remain in the effectiveness section`);
assert.match(form,/function actionEffectivenessMissingKey\(/,'effectiveness validation must focus the exact missing residual-risk field');
assert.match(actionRecordService,/const effectivenessKeys = \['effectivenessStatus', 'effectivenessNote', 'effectivenessDate', 'residualSeverity', 'residualOccurrence', 'residualDetectability', 'residualRiskLevel', 'residualRiskBasis'\]/,'changing residual risk must refresh effectiveness reviewer attribution');
assert.match(actions,/function actionEvidenceTimelineHtml\(/,'chi tiết NCE phải tách các mốc xảy ra, chạy lại, hủy điểm và mở hồ sơ');
assert.match(actions,/ActionEvidencePresentation\.timeline\(a,rr\)/,'route timeline NCE phải dùng model TS thay vì tự suy luận mốc');
for(const label of ['Ngày xảy ra','QC chạy lại','Hủy điểm','Mở hồ sơ'])assert.match(actionEvidencePresentation,new RegExp(`label: '${label}'`),`timeline NCE phải giữ mốc ${label}`);
assert.match(actions,/function actionRerunEvidenceHtml\(/,'NCE phải có khung bằng chứng QC chạy lại riêng');
assert.match(actions,/function openActionQcEvidence\(/,'khung bằng chứng phải mở được đúng điểm QC');
assert.match(entry,/data-qc-point-id=/,'dòng dữ liệu QC phải mang ID để liên kết từ hồ sơ NCE');
assert.match(entry,/rangeSummary=allSt\?`N=\$\{allSt\.n\}/,'thống kê toàn bộ phải dùng ký hiệu N viết hoa');
assert.match(actions,/function openActionQcEvidence[\s\S]*entryDetailOpen\.add\('points'\)[\s\S]*go\('entry'\)/,'mở bằng chứng NCE phải bung khối điểm QC trước khi tô sáng dòng');

console.log('UI route structure tests passed');
