const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const QCCore=require('../assets/core.js');

const router=read('src/presentation/router/router-dispatch-controller.ts')+read('src/presentation/router/router-permission.ts')+read('src/presentation/router/router-icons.ts')+read('src/presentation/router/live-row-filter.ts')+read('src/presentation/router/date-box-html.ts');
const compat=read('src/compat/modular-pilot.global.ts');
const routerPolicy=read('src/presentation/router/router-page-policy.ts');
const routerShell=read('src/presentation/router/router-shell-controller.ts');
const vnDatePicker=read('src/presentation/router/vn-date-picker-controller.ts');
const entry=read('src/presentation/entry/entry-page-controller.ts');
const entryPointRow=read('src/presentation/entry/entry-point-table-row-html.ts');
const westgard=read('src/presentation/westgard/westgard-page-controller.ts');
const modals=read('src/presentation/modal/modal-focus-trap.ts')+read('src/presentation/modal/modal-template.ts')+read('src/presentation/modal/modal-controller.ts')+read('src/presentation/modal/dialog-overlay-controller.ts');
const actions=read('src/presentation/actions/actions-page-controller.ts');
const actionCancelModal=read('src/presentation/nce/action-cancel-modal-html.ts');
const actionInvestigationField=read('src/presentation/nce/action-investigation-field-html.ts');
const actionFormPanel=read('src/presentation/nce/action-form-panel-html.ts');
const form=read('src/presentation/actions/action-form-controller.ts');
const actionRecordService=read('src/application/nce/action-record-service.ts');
const actionEvidencePresentation=read('src/presentation/nce/action-evidence-presentation.ts');
const report=read('src/presentation/report/report-page-controller.ts');
const reportPage=read('src/react/pages/ReportPage.tsx');
const sigma=read('src/presentation/sigma/sigma-page-controller.ts');
const sigmaTea=read('src/domain/sigma/sigma-tea-resolution.ts');
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
/* Pha H2 lát cuối (2026-08-20): script-src không còn 'unsafe-inline' — toàn bộ
   onclick=/oninput=/onchange=/onkeydown=/onmousemove= trần và 2 khối <script> nội tuyến
   cũ đã chuyển sang action-dispatcher.ts/file ngoài. style-src giữ nguyên, không liên
   quan (JS còn gán style="..." trực tiếp ở nhiều nơi, chưa nằm trong phạm vi này). */
const scriptSrc=cspTags[0].match(/script-src [^;]+/)[0];
assert.doesNotMatch(scriptSrc,/'unsafe-inline'/,'script-src không được có unsafe-inline sau Pha H2');
assert.match(cspTags[0],/style-src 'self' 'unsafe-inline'/,'style-src vẫn giữ unsafe-inline, không thuộc phạm vi Pha H2');
const indexNoComments=index.replace(/<!--[\s\S]*?-->/g,'');
assert.doesNotMatch(indexNoComments,/<script(?![^>]*\ssrc=)[^>]*>/,'index.html không còn khối <script> nội tuyến (mọi <script> phải có src=)');
assert.doesNotMatch(indexNoComments,/ onclick="| oninput="| onchange="| onkeydown="| onmousemove="/,'index.html không còn thuộc tính onXXX= trần');

assert.doesNotMatch(router,/function page(?:Dash|Entry|Westgard)\(/,'router-render chỉ giữ điều phối và UI primitives');
assert.match(entry,/const pageEntry = \(rightOnly = false\)/);
assert.match(westgard,/const pageWestgard = \(\) => \{/);

/* core.js phải tiếp tục độc lập với bundle presentation, nên PAGE_SET/ROLE_SET ở core.js
   và router policy TypeScript vẫn là hai khai báo tách rời. Test này là lưới an toàn: nếu
   thêm/xóa trang hoặc vai trò ở một bên, import backup có thể mất quyền âm thầm. */
const pageDefsMatch=routerPolicy.match(/const ROUTER_PAGE_DEFS=\[([\s\S]*?)\] as const;/);
assert.ok(pageDefsMatch,'router page policy TypeScript phải khai báo ROUTER_PAGE_DEFS');
const routerPageIds=[...pageDefsMatch[1].matchAll(/\['([a-z]+)','[^']*',\[/g)].map(m=>m[1]);
assert.deepStrictEqual(new Set(routerPageIds),QCCore.PAGE_SET,'Tập id trang ở router policy TypeScript phải khớp PAGE_SET (core.js) — sanitizeBackup() lọc pagePerms theo PAGE_SET, lệch tập là mất quyền âm thầm khi nhập backup');
const roleListMatch=routerPolicy.match(/const ROUTER_ROLE_LIST=\[([\s\S]*?)\] as const;/);
assert.ok(roleListMatch,'router page policy TypeScript phải khai báo ROUTER_ROLE_LIST');
const routerRoles=[...roleListMatch[1].matchAll(/'([a-z]+)'/g)].map(m=>m[1]);
assert.deepStrictEqual(new Set(routerRoles),QCCore.ROLE_SET,'ROUTER_ROLE_LIST TypeScript phải khớp ROLE_SET (core.js)');
assert.doesNotMatch(router,/const PAGE_DEFS=/,'router presentation không giữ registry trang classic');
assert.match(compat,/root\.routerPagePolicy\.canAccessPage/,'router bridge phải tiêu thụ policy TypeScript');
assert.match(routerShell,/export function createRouterShellController\(/,'navigation shell phải do TypeScript sở hữu');
assert.match(compat,/root\.routerShell\.nav/,'router bridge phải ủy quyền navigation shell cho TypeScript');
assert.match(vnDatePicker,/export function createVnDatePickerController\(/,'VN date picker controller phải nằm trong TypeScript');
assert.match(compat,/root\.vnDatePickerController\.parse/,'router bridge phải dùng parser ngày TypeScript');

/* Trang Báo cáo chuyển sang React (2026-08-30, xem ReportPage.tsx và
   docs/REACT-ADOPTION-PLAN.md) — pageReportV2()/reportLockPanelHtml()/
   reportRangePicker()/reportApplySearch() đã xóa, chỉ còn reportModel() (dữ
   liệu thuần) ở report-page-controller.ts. Vẫn chốt report-page-controller.ts
   không lẫn logic trang Khắc phục sự cố, và actions-routes.js không còn tham
   chiếu ngược lại trang Báo cáo — cùng lý do đã tách dash/entry/westgard khỏi
   router-render.js. */
assert.match(report,/const reportModel = \(\) => \{/,'trang Báo cáo (reportModel) phải nằm ở report-page-controller.ts');
for(const name of ['reportDateRange','reportRangeText'])assert.match(report,new RegExp(`const ${name} = `),`${name} thuộc controller trang Báo cáo`);
assert.match(report,/let reportQ = ''/,'state của trang Báo cáo đi cùng controller (closure), không bỏ lại actions-routes.js');
assert.doesNotMatch(actions,/\breport[A-Z_]/,'actions-routes.js không còn tham chiếu nào tới trang Báo cáo');
assert.doesNotMatch(report,/\bpageActionsV4\b|\bACT_[A-Z]/,'report-page-controller.ts không được kéo theo logic trang Khắc phục sự cố');
assert.doesNotMatch(actions,/===== ACTIONS & REPORT PAGE ROUTES =====/,'tiêu đề file phải theo kịp việc tách trang');

/* Lớp giải TEa tách khỏi sigma.js (2026-08-01) sau khi bản đồ độ phủ
   (`npm run coverage-map`) chỉ ra sigma.js 85 KB chỉ chạy 34,4% và 51 hàm chưa
   test nào chạm tới — phần lớn điểm mù nằm ở đúng lớp THUẦN này. Cắt một chiều:
   sigma.js gọi sang sigma-tea.js, chiều ngược lại phải TRỐNG, nếu không lớp này
   hết test được bằng Node. Test riêng: tests/sigma-tea.test.js. */
for(const name of ['effectiveTeaRefs','sgRef','sgTeaInfo','sgTeaSource','sgTeaSnapshot','sgSetLevelTeaSnapshot','sgEntryTea','sgCliaCriterion','sgUnitsMatch','teaRefRecordForName'])assert.match(sigmaTea,new RegExp(`const ${name}\\s*=`),`${name} thuộc lớp giải TEa`);
assert.match(sigmaTea,/^\s*const SG_TEA_SOURCES/m,'danh mục nguồn TEa đi cùng lớp giải TEa');
assert.doesNotMatch(sigma,/const (?:effectiveTeaRefs|sgRef|sgTeaInfo|sgTeaSnapshot|sgCliaCriterion) = /,'sigma-page-controller.ts không được giữ lại lớp giải TEa (chỉ được gọi qua deps, không định nghĩa lại)');
assert.doesNotMatch(sigmaTea,/function (?:pageSigma|sgComp|sgMU|sgRefresh|sgOpenMU|sgOpenBias)\(/,'lớp giải TEa không được kéo theo trang Sigma, MU hay modal');
assert.doesNotMatch(sigmaTea,/document\.|openModal\(|rerender\(/,'lớp giải TEa phải thuần — chạm DOM là hết test bằng Node');

assert.match(modals,/const modalTemplate=/);
assert.match(modals,/const modalCloseButton=/);
assert.doesNotMatch(modals,/(?:function|const) (?:syncActLevels|currentIssues|beginActionFromIssue|addAction|cancelAction)\b/,'modal-*.ts không chứa logic trang Actions');
/* Form NCE tách khỏi actions-routes.js (2026-07-30) sau khi trang Báo cáo ra riêng mà
   file vẫn còn 94 KB — phần lớn là form 8 mục nằm gọn trong MỘT hàm pageActionsV4() 17 KB.
   Đường cắt này cố ý KHÔNG một chiều (khác report-routes.js): form gọi ngược các khối
   dựng bằng chứng của trang, trang gọi vào form để mở/lưu hồ sơ. Vì vậy test chốt theo
   TRÁCH NHIỆM — hàm nào ở file nào — chứ không đòi đồ thị phụ thuộc không chu trình. */
for(const name of ['currentIssues','cancelAction','viewActionDetail','openActionGuide'])assert.match(actions,new RegExp(`const ${name} = `),`${name} thuộc phần trang/vòng đời`);
for(const name of ['syncActLevels','beginActionFromIssue','addAction','actionFormHtml','actionFormModel','actionSection','actionSuggestBox','actionInvestigationField','readActionProtocolForm'])assert.match(form,new RegExp(`const ${name} = `),`${name} thuộc form NCE`);
assert.doesNotMatch(actions,/const actionFormModel = |\bACT_SUGGEST\b\s*=/,'actions-routes.js không được giữ lại phần dựng form');
assert.doesNotMatch(form,/const (?:pageActionsV4|currentIssues|approveAction|viewActionDetail) = /,'action-form.js không được kéo theo trang và vòng đời hồ sơ');
/* pageActionsV4() từng dựng cả form 8 mục trong chính nó; giờ phải gọi sang actionFormHtml()
   và chỉ truyền số sự cố — nếu nó tự currentIssues() lần nữa thì danh sách trên màn hình và
   con số trong khung "chưa chọn sự cố" có thể lệch nhau. */
assert.match(actions,/deps\.formHtml\(issues\.length\)/,'trang phải dùng lại đúng tập sự cố đã tính cho panel form');
assert.doesNotMatch(actions,/class="action-form-body"/,'markup form không được ở lại actions-routes.js');
assert.doesNotMatch(actionsArea,/state\(\)\.actions\.splice\(/,'hồ sơ NCE không được xóa vật lý; phải hủy có lưu vết');
assert.match(actions,/deps\.NceLifecycleWorkflowCommand\.execute\(\{\s*kind: 'cancel'/,'quy trình hủy phải gọi workflow hủy mềm TypeScript');
assert.doesNotMatch(actions,/const confirmReturnAction = \(i:/,'xác nhận trả lại không được dựa vào vị trí mảng có thể thay đổi khi đồng bộ');
assert.match(actions,/const confirmReturnAction = \(id: unknown, token: unknown\) => \{/,'xác nhận trả lại phải khóa theo ID và token phiên bản');
assert.match(actions,/\{ action: 'confirmReturnAction', args: \[current\.id, token\] \}/,'hộp thoại trả lại phải truyền đúng ID và token của hồ sơ sau xác thực');

/* Form hồ sơ NCE phải render THẲNG từ state qua actionFormModel(): bản cũ đổ giá trị
   vào DOM sau render (populateActionForm trong setTimeout) nên mọi rerender() — đổi
   trang rồi quay lại, hay một bản đồng bộ Firebase dội về — xoá trắng form đang sửa. */
assert.match(form,/const actionFormModel = \(editing: AnyRec, tests: AnyRec\[\]\) => /,'form NCE phải có model render từ state');
assert.doesNotMatch(actionsArea,/const (?:populateActionForm|actionSetField|fillAction) = /,'không đổ giá trị vào form sau render');
/* Danh tính sự cố bất biến khi sửa: đổi ô "Xét nghiệm" từng làm actionPoint() trả null
   và bỏ luôn yêu cầu QC chạy lại, còn lot bị ghi đè theo lô hiện hành sau mỗi lần chuyển lô. */
assert.match(form,/editing \? 'disabled' : 'data-action="syncActLevels" data-action-on="change"'/,'ô Xét nghiệm phải khoá khi sửa hồ sơ');
assert.match(form,/const tid = editing \? editing\.testId : /,'addAction\\(\\) không lấy testId từ form khi sửa');
assert.match(form,/const lot = editing \? \(editing\.lot \|\| ''\) : /,'lot phải giữ snapshot lúc mở hồ sơ');
/* Lối thoát cho hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng (sửa/xóa/duyệt
   đều bị chặn) — xem actionCanReopen() trong actions-page-controller.ts. */
assert.match(actions,/const actionCanReopen = \(a: AnyRec\) => /,'phải có đường mở lại hồ sơ duyệt-nhưng-hở');
assert.match(actions,/const confirmApproveAction = \(id: unknown, token: unknown\) => \{/,'xác nhận duyệt phải tìm hồ sơ theo id và khóa phiên bản đã xem');
assert.match(actions,/actionApprovalToken\(a\) !== token/,'phải chặn duyệt nếu hồ sơ hoặc bằng chứng QC đổi khi hộp duyệt đang mở');
assert.doesNotMatch(actionsArea,/!tests\.length\?emptyState\('Cần có xét nghiệm trước'/,'NCE nguồn ngoài IQC phải mở được cả khi chưa có xét nghiệm vận hành');
assert.match(form,/const actionInvestigationChoose = \(statusId: string, value: string\) => \{/,'checklist điều tra phải dùng lựa chọn trạng thái dạng nút');
assert.match(actionInvestigationField,/class="action-investigation-select"/,'select dữ liệu gốc phải được giữ để tương thích state và kiểm thử');
assert.match(form,/const actionChecklistChip = \(form: AnyRec\) => /,'tiêu đề checklist phải hiển thị tiến độ hoàn tất');
assert.match(form,/const actionSuggestBox = \(targetId: string, phrases: string\[\], label = 'Gợi ý nhập nhanh'\): string => \{/,'gợi ý nhập liệu NCE phải dùng cùng một khối thu gọn');
assert.match(actionFormPanel,/class="action-form-panel-head"/,'renderer TypeScript phải giữ nút quy trình cạnh tiêu đề panel lập hồ sơ NCE');
assert.match(form,/guideButtonHtml: deps\.btn\('Quy trình 8 bước', \{ action: 'openActionGuide' \}, 'ghost sm'\)/,'nút quy trình phải tiếp tục dùng helper btn của route legacy');
assert.match(reportsCss,/\.action-form-panel-head\{[^}]*justify-content:space-between/,'header lập hồ sơ NCE phải tách tiêu đề trái và nút quy trình sang phải');
assert.match(reportsCss,/\.action-form-panel-head\{[^}]*color:var\(--card-head-ink\);[^}]*font-size:var\(--section-head-size\);[^}]*font-weight:800/,'header lập hồ sơ NCE phải dùng đúng token chữ của header panel hệ thống');
assert.match(reportsCss,/\.action-form-panel \.action-form-panel-head > \.panel-title\{[^}]*flex:1;[^}]*color:inherit;[^}]*font:inherit/,'tiêu đề lập hồ sơ NCE phải kế thừa nguyên kiểu chữ hệ thống từ header');
assert.doesNotMatch(actionsArea,/headOnly\([^;\n]+btn\('Quy trình 8 bước'/,'nút quy trình không được chiếm chỗ trên header trang');
assert.match(actions,/cls: 'action-guide-modal'/,'hướng dẫn 8 bước phải dùng popup NCE chuyên biệt');
assert.match(actionCancelModal,/class="alert warn action-cancel-warning"/,'cảnh báo hủy NCE phải có bố cục riêng để nội dung không bị ép thành hai cột');
assert.match(reportsCss,/\.action-cancel-warning\{[^}]*width:100%;[^}]*flex-direction:column/,'cảnh báo hủy NCE phải xếp câu chính và giải thích theo chiều dọc');
assert.match(reportPage,/className="report-export-options"[\s\S]*?Kèm phụ lục NCE[\s\S]*?\(Áp dụng cho PDF và Excel\)[\s\S]*?className="report-actions"/,'tùy chọn phụ lục NCE phải nằm ở dòng riêng phía trên các nút xuất và có chú thích trong ngoặc');
assert.match(reportsCss,/\.report-nce-option span\{[^}]*display:inline-flex;[^}]*align-items:baseline;[^}]*white-space:nowrap/,'nhãn và chú thích phụ lục NCE phải nằm cùng hàng');
assert.match(reportsCss,/\.report-nce-option\{[^}]*align-items:center/,'ô tick phải căn giữa theo chiều dọc với nhãn phụ lục NCE');
assert.match(reportsCss,/\.report-nce-option input\{[^}]*margin:0/,'ô tick phụ lục NCE không được giữ độ lệch thủ công');
assert.match(reportsCss,/@media\(max-width:760px\)\{[\s\S]*?\.report-nce-option span\{[^}]*white-space:normal;[^}]*flex-wrap:wrap/,'nhãn phụ lục NCE được phép xuống hàng trên màn hình hẹp');
assert.doesNotMatch(reportPage,/className="report-actions"[\s\S]*?report-nce-option/,'checkbox phụ lục NCE không được trộn cùng hàng nút hành động');
assert.doesNotMatch(actions,/action-guide-(?:mark|legend)/,'hướng dẫn NCE không được dùng logo phụ hoặc dải màu phân nhóm');
assert.match(reportsCss,/\.action-guide-list\{[^}]*grid-template-columns:1fr/,'quy trình NCE phải là một danh sách tuyến tính dễ đọc');
assert.match(reportsCss,/\.action-guide-card\{[^}]*border-bottom:1px solid var\(--line\)/,'các bước NCE chỉ phân cách bằng đường kẻ trung tính, không dùng card màu');
for(const id of ['aContainmentNote','aCorrection','aCause','aAct','aPatientAction','aEffectivenessNote'])assert.match(form,new RegExp(`actionSuggestBox\\('${id}'`),`${id} phải dùng gợi ý thu gọn`);

assert.match(form,/deps\.NceFormWorkflowCommand\.submit\(\{\s*editId: editing && editing\.id, values: \{ \.\.\.\(editing \|\| \{\}\), \.\.\.protocol, nceId: \(editing && editing\.nceId\) \|\| nceId, testId: tid, level, lot, pointId, date, rule, errorType, action, by \}/,'workflow NCE phải nhận snapshot danh tính IQC bất biến khi sửa trước khi kiểm tra cổng chạy lại');
for(const id of ['aReleaseStatus','aReleaseDate','aReleaseBy','aReleaseNote'])assert.match(form,new RegExp(`['"]${id}['"]`),`${id} must remain in the release-decision form`);
assert.match(form,/actionSuggestBox\('aReleaseNote'/,'release rationale must keep the same editable suggestion pattern');
assert.match(form,/actionSuggestBox\('aRiskBasis'/,'risk classification must keep an editable SOP-basis field');
assert.match(form,/actionSuggestBox\('aResidualRiskBasis'/,'residual-risk reassessment must keep an editable evidence field');
for(const id of ['aResidualSeverity','aResidualOccurrence','aResidualDetectability','aResidualRiskLevel','aResidualRiskBasis'])assert.match(form,new RegExp(`['"]${id}['"]`),`${id} must remain in the effectiveness section`);
assert.match(form,/const actionEffectivenessMissingKey = \(a: AnyRec\) => /,'effectiveness validation must focus the exact missing residual-risk field');
assert.match(actionRecordService,/const effectivenessKeys = \['effectivenessStatus', 'effectivenessNote', 'effectivenessDate', 'residualSeverity', 'residualOccurrence', 'residualDetectability', 'residualRiskLevel', 'residualRiskBasis'\]/,'changing residual risk must refresh effectiveness reviewer attribution');
assert.match(actions,/const actionEvidenceTimelineHtml = \(a: AnyRec, rr: AnyRec\) => \{/,'chi tiết NCE phải tách các mốc xảy ra, chạy lại, hủy điểm và mở hồ sơ');
assert.match(actions,/deps\.ActionEvidencePresentation\.timeline\(a, rr\)/,'route timeline NCE phải dùng model TS thay vì tự suy luận mốc');
for(const label of ['Ngày xảy ra','QC chạy lại','Hủy điểm','Mở hồ sơ'])assert.match(actionEvidencePresentation,new RegExp(`label: '${label}'`),`timeline NCE phải giữ mốc ${label}`);
assert.match(actions,/const actionRerunEvidenceHtml = \(a: AnyRec, rr: AnyRec, t: AnyRec\) => \{/,'NCE phải có khung bằng chứng QC chạy lại riêng');
assert.match(actions,/const openActionQcEvidence = \(tid: unknown, level: unknown, pointId: unknown, date: unknown, lot: unknown\) => \{/,'khung bằng chứng phải mở được đúng điểm QC');
assert.match(entryPointRow,/data-qc-point-id=/,'dòng dữ liệu QC phải mang ID để liên kết từ hồ sơ NCE');
assert.match(entry,/const rangeSummary = allSt \? `N=\$\{allSt\.n\}/,'thống kê toàn bộ phải dùng ký hiệu N viết hoa');
assert.match(actions,/const openActionQcEvidence = \([^)]*\) => \{[\s\S]*?entryDetailOpen\.add\('points'\)[\s\S]*?deps\.go\('entry'\)/,'mở bằng chứng NCE phải bung khối điểm QC trước khi tô sáng dòng');

console.log('UI route structure tests passed');
