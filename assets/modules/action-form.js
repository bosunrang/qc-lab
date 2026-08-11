/* ===== NCE FORM (trang Khắc phục sự cố) ===== */
/* Tách khỏi actions-routes.js (2026-07-30), sau khi file đó đã nhả trang Báo cáo mà vẫn
   còn 94 KB. Ở đây là TOÀN BỘ phần dựng và đọc lại form hồ sơ NCE: hằng số lựa chọn
   (ACT_*), chip gợi ý, khối <details> 8 mục, checklist điều tra, bản nháp giữ qua
   rerender(), model render-từ-state và addAction(). actions-routes.js giữ phần còn lại
   của trang: danh sách sự cố, vòng đời hồ sơ (duyệt/trả lại/hủy/escalate/mở lại) và
   phiếu chi tiết.

   Khác với lần tách report-routes.js, đường cắt này KHÔNG một chiều: form gọi ngược vài
   hàm dựng bằng chứng của trang (actionEvidenceTimelineHtml, actionRerunEvidenceHtml,
   actionLevelShort) vì phiếu chi tiết dùng chung đúng các khối đó, và trang gọi vào form
   để mở/đóng/lưu hồ sơ. Trong một global scope duy nhất thì điều đó vô hại — thứ được
   bảo đảm ở đây là RANH GIỚI TRÁCH NHIỆM, không phải đồ thị phụ thuộc không chu trình;
   tests/ui-route-structure.test.js chốt đúng theo nghĩa đó. Nạp ngay sau
   actions-routes.js trong index.html. */
/* Form hồ sơ NCE được render THẲNG TỪ STATE (bản ghi đang sửa qua actionEditId, hoặc
   actionSeed khi mở từ một vi phạm) chứ không đổ giá trị vào DOM sau render. Bản đầu
   đổ giá trị vào DOM một lần sau render, nên mọi rerender() sau đó — đổi trang rồi quay
   lại, hay một bản đồng bộ Firebase dội về — đều xoá trắng form trong khi tiêu đề vẫn
   ghi "Tiếp tục hồ sơ", và lần lưu kế tiếp ghi rỗng đè lên checklist/nguyên nhân/hành
   động đã có. */
let actionEditId='',actionSeed=null,actionDraft=null;
/* Mục nào đang mở. null = chưa ai đụng tới, dùng mặc định theo giai đoạn hồ sơ: hồ sơ
   mới chỉ mở khối nhận diện + mục 1 (đúng phần tối thiểu để lưu), hồ sơ đang sửa mở
   sẵn các mục còn thiếu để bấm "Tiếp tục" là thấy ngay việc phải làm. Trước đây cả 7
   mục bung hết ngay từ đầu — 2350px, ~3 màn hình cuộn cho một thao tác chỉ cần 6 ô. */
let actionOpenSections=null;
function actionSectionToggled(key,open){
  if(!actionOpenSections)actionOpenSections=new Set();
  if(open)actionOpenSections.add(key);else actionOpenSections.delete(key);
}
function actionDefaultOpenSections(editing,protocol){
  if(!editing)return new Set(['immediate']);
  const miss=protocol&&protocol.missingBySection||{};
  const open=new Set(['immediate','risk','check','cause','patient'].filter(k=>(miss[k]||[]).length));
  /* Mục 8 mở sẵn khi hồ sơ đã qua được checklist — lúc đó đánh giá hiệu lực mới là
     việc còn lại phải làm. */
  if(!open.size&&editing&&!actionEffectivenessStatus({...editing,protocolVersion:editing.protocolVersion||2}).complete)open.add('eff');
  return open;
}
/* Luật Westgard là bộ từ vựng đóng — không có lý do gì để gõ tay. actSel() tự thêm
   option cho giá trị lạ nên hồ sơ cũ (hoặc chuỗi nhiều luật "1-3s, 2-2s" sinh từ dòng
   vi phạm) vẫn hiện đúng thay vì rơi im lặng về option đầu. */
function actionRuleOptions(){return [['','Không có luật Westgard'],...QCCore.WG_RULES.map(r=>[r,r])];}
/* Người phụ trách: datalist thay vì select vì vẫn phải cho gõ tên người ngoài danh
   sách (nhân viên mới, người trực thay). Chọn từ danh sách còn giúp actionCanApprove()
   đối chiếu đúng — hiện nó so theo tên, gõ sai chính tả là quy tắc "không tự duyệt hồ
   sơ của mình" bị vô hiệu. */
function actionStaffOptions(){
  const names=[...new Set((state.users||[]).filter(u=>u.active!==false).map(u=>String(u.name||u.username||'').trim()).filter(Boolean))];
  return names.map(n=>`<option value="${escAttr(n)}"></option>`).join('');
}
/* [id ô trong DOM, khóa trong bản ghi, kiểu] — một bảng dùng cho cả ba việc: dựng giá
   trị ban đầu của form, giữ nội dung ĐANG GÕ qua rerender(), và tìm ô ứng với trường
   còn thiếu khi validate. Chỉ 'num' cần đổi kiểu; 'date' và 'text' đi thẳng vào ô vì
   dateBox() nhận được cả chuỗi dd/mm/yyyy lẫn yyyy-mm-dd. */
const ACT_FIELDS=[
  ['aNceId','nceId','text'],['aTest','testId','text'],['aLevel','level','text'],['aPointId','pointId','text'],
  ['aDate','date','date'],['aRule','rule','text'],['aEventSource','eventSource','text'],['aProcessPhase','processPhase','text'],
  ['aErr','errorType','text'],['aBy','by','text'],['aDueDate','dueDate','date'],
  ['aContainment','containmentStatus','text'],['aContainmentNote','containmentNote','text'],['aCorrection','correction','text'],
  ['aRiskSeverity','riskSeverity','num'],['aRiskOccurrence','riskOccurrence','num'],['aRiskDetectability','riskDetectability','num'],['aRiskLevel','riskLevel','text'],['aRiskBasis','riskBasis','text'],
  ['aQcMaterial','qcMaterialStatus','text'],['aQcMaterialNote','qcMaterialNote','text'],
  ['aInstrument','instrumentStatus','text'],['aInstrumentNote','instrumentNote','text'],
  ['aReagent','reagentStatus','text'],['aReagentNote','reagentNote','text'],
  ['aCalibration','calibrationStatus','text'],['aCalibrationNote','calibrationNote','text'],
  ['aLotToLot','lotToLotStatus','text'],['aLotToLotNote','lotToLotNote','text'],
  ['aCauseCategory','causeCategory','text'],['aCause','cause','text'],['aAct','action','text'],['aActionCompletedDate','actionCompletedDate','date'],
  ['aBiasBefore','biasBefore','text'],['aBiasAfter','biasAfter','text'],
  ['aReleaseStatus','releaseStatus','text'],['aReleaseDate','releaseDate','date'],['aReleaseBy','releaseBy','text'],['aReleaseNote','releaseNote','text'],
  ['aPatientImpact','patientImpact','text'],['aPatientAction','patientAction','text'],
  ['aEffectivenessStatus','effectivenessStatus','text'],['aEffectivenessDate','effectivenessDate','date'],['aEffectivenessNote','effectivenessNote','text'],
  ['aResidualSeverity','residualSeverity','num'],['aResidualOccurrence','residualOccurrence','num'],['aResidualDetectability','residualDetectability','num'],['aResidualRiskLevel','residualRiskLevel','text'],['aResidualRiskBasis','residualRiskBasis','text']
];
const ACT_CHECK_FIELDS=[
  ['aQcMaterial','aQcMaterialNote','qcMaterialStatus','qcMaterialNote'],
  ['aInstrument','aInstrumentNote','instrumentStatus','instrumentNote'],
  ['aReagent','aReagentNote','reagentStatus','reagentNote'],
  ['aCalibration','aCalibrationNote','calibrationStatus','calibrationNote'],
  ['aLotToLot','aLotToLotNote','lotToLotStatus','lotToLotNote']
];
/* Bản nháp đang gõ được chụp lại sau mỗi lần thay đổi ô, và render lại từ đó. Nếu chỉ
   dựa vào bản ghi trong state thì hồ sơ MỚI (chưa lưu) vẫn mất sạch nội dung mỗi khi
   có rerender() — ví dụ Firebase dội một bản đồng bộ về giữa lúc đang nhập. */
function captureActionDraft(){
  const values={};let found=false;
  ACT_FIELDS.forEach(([id])=>{const e=document.getElementById(id);if(e){found=true;values[id]=e.value;}});
  if(found)actionDraft={id:actionEditId||'',values};
}
function actionFormChanged(){
  captureActionDraft();actionRefreshSectionChips();
}
function actionDraftValues(){return actionDraft&&actionDraft.id===(actionEditId||'')?actionDraft.values:null;}
function clearActionDraft(){actionDraft=null;}
const ACT_SOURCE_OPTS=[['','— Chọn nguồn —'],...Object.entries(ACTION_LABELS.source)];
/* Hồ sơ không gắn điểm QC thì không được chọn "Nội kiểm IQC": sự cố IQC phải mở từ dòng
   vi phạm, nếu không hệ thống mất đường theo dõi QC chạy lại. Hồ sơ cũ lỡ mang giá trị
   đó vẫn giữ option để hiện đúng tên — phần chặn do actionDraftStatus() lo. */
function actionSourceOptions(qcBound,current){
  return(qcBound||current==='iqc')?ACT_SOURCE_OPTS:ACT_SOURCE_OPTS.filter(([v])=>v!=='iqc');
}
const ACT_PHASE_OPTS=Object.entries(ACTION_LABELS.phase);
const ACT_ERR_OPTS=[['','— Chưa xác định —'],['SE — Sai số hệ thống','SE — Sai số hệ thống'],['RE — Sai số ngẫu nhiên','RE — Sai số ngẫu nhiên']];
const ACT_CONTAIN_OPTS=[['','— Chọn —'],...Object.entries(ACTION_LABELS.containment)];
const ACT_RISK_LEVEL_OPTS=[['','— Chọn —'],...Object.entries(ACTION_LABELS.risk)];
const ACT_CAUSE_OPTS=[['','— Chọn —'],...Object.entries(ACTION_LABELS.cause)];
const ACT_RELEASE_OPTS=[['','Chưa cho phép trở lại'],...Object.entries(ACTION_LABELS.release)];
const ACT_PATIENT_OPTS=[['','— Chọn —'],...Object.entries(ACTION_LABELS.patient)];
const ACT_EFF_OPTS=[['pending','Chưa đánh giá'],['effective','Có hiệu lực'],['ineffective','Chưa hiệu lực — cần xử lý tiếp']];
/* Nhãn dài hơn ACTION_LABELS.check vì trong form cần giải thích khi nào chọn mục nào. */
const ACT_CHECK_OPTS=[['','— Chọn —'],['ok','Đạt'],['abnormal','Bất thường'],['na','Không áp dụng']];
const ACT_LOT2LOT_OPTS=[['','— Chọn —'],['not-needed','Không cần — không đổi lô gần đây'],['checked-ok','Đã kiểm tra — đạt'],['checked-abnormal','Đã kiểm tra — bất thường']];
const ACT_SEVERITY_OPTS=[['','—'],['1','1 — Không đáng kể'],['2','2 — Nhẹ'],['3','3 — Trung bình'],['4','4 — Nặng'],['5','5 — Rất nghiêm trọng']];
const ACT_OCCURRENCE_OPTS=[['','—'],['1','1 — Hiếm'],['2','2 — Ít gặp'],['3','3 — Có thể'],['4','4 — Thường gặp'],['5','5 — Rất thường gặp']];
const ACT_DETECT_OPTS=[['','—'],['1','1 — Gần như chắc chắn phát hiện'],['2','2 — Dễ phát hiện'],['3','3 — Trung bình'],['4','4 — Khó phát hiện'],['5','5 — Rất khó phát hiện']];
/* Câu gợi ý cho các ô văn tường thuật. CHÈN ĐƯỢC VÀ SỬA ĐƯỢC, cố ý không phải dropdown
   cứng: nếu "nguyên nhân gốc" chỉ chọn từ một danh sách đóng thì mọi hồ sơ NCE sẽ có
   cùng một câu và không chứng minh được là đã thực sự điều tra khi bị đánh giá ISO
   15189 — đúng điểm yếu của lý do hủy điểm QC dạng chuỗi mẫu. */
const ACT_SUGGEST={
  correction:['Dừng trả kết quả liên quan','Cô lập lô QC đang dùng','Thông báo phụ trách khoa','Chạy lại QC với lọ mới','Tạm dừng máy chờ kiểm tra'],
  containmentNote:['Giữ kết quả từ đầu ca','Chỉ ảnh hưởng mức QC này','Chưa trả kết quả nào ra ngoài'],
  riskBasis:['Theo ma trận nguy cơ trong SOP quản lý sự không phù hợp','Theo SOP đánh giá nguy cơ của phòng xét nghiệm','Theo mức ảnh hưởng lâm sàng và khả năng phát hiện'],
  releaseNote:['QC chạy lại đã được chấp nhận','Đã xác nhận máy và hóa chất hoạt động ổn định','Phụ trách khoa đã rà soát và cho phép vận hành'],
  patientAction:['Không có kết quả nào đã trả ra','Rà soát kết quả từ lần QC đạt cuối','Chạy lại và trả kết quả đính chính','Đã thông báo lâm sàng'],
  effectivenessNote:['Theo dõi 20 lần chạy sau không tái diễn','QC ổn định trong 2 tuần tiếp theo','Vấn đề tái diễn, cần xử lý tiếp'],
  residualRiskBasis:['Đánh giá lại theo cùng ma trận nguy cơ ban đầu','Theo SOP-QC-07 sau thời gian theo dõi','Dựa trên dữ liệu QC sau khắc phục và khả năng phát hiện hiện tại'],
  qcMaterialNote:['Còn hạn, bảo quản đúng 2–8°C','Lọ QC đã mở quá số ngày cho phép','Hoàn nguyên chưa đủ thời gian','Lọ QC bị đục hoặc kết tủa'],
  instrumentNote:['Máy không có cảnh báo','Kim hút có cặn hoặc tắc','Nhiệt độ buồng ủ lệch','Đã tới hạn bảo trì định kỳ'],
  reagentNote:['Hóa chất còn hạn, đúng điều kiện','Vừa đổi lô hóa chất','Hóa chất đã mở quá hạn ổn định','Có bọt khí trong đường hút'],
  calibrationNote:['Hiệu chuẩn còn hiệu lực','Đã quá hạn hiệu chuẩn','Đã hiệu chuẩn lại sau sự cố'],
  lotToLotNote:['Không đổi lô trong kỳ này','Đã so sánh, kết quả tương đương','Lệch giữa hai lô vượt giới hạn']
};
/* Nguyên nhân gốc gợi theo đúng nhóm nguyên nhân đang chọn — đây mới là chỗ tiết kiệm
   thao tác thật, thay vì một danh sách chung chung cho mọi nhóm. */
const ACT_SUGGEST_CAUSE={
  qc:['Lọ QC hỏng hoặc quá hạn ổn định','Hoàn nguyên hoặc pha chưa đúng','Bảo quản QC không đúng nhiệt độ'],
  operator:['Thao tác hút mẫu chưa đúng','Nhầm mức hoặc nhầm lọ QC','Chưa trộn đều trước khi chạy'],
  instrument:['Kim hút bẩn làm sai thể tích hút','Bộ phận quang/điện cực suy giảm','Nhiệt độ buồng ủ không ổn định'],
  reagent:['Lô hóa chất mới lệch so với lô cũ','Hóa chất suy giảm do bảo quản','Calibrator hết hạn'],
  calibration:['Hiệu chuẩn trôi theo thời gian','Chưa hiệu chuẩn sau khi thay lô','Hiệu chuẩn lỗi do calibrator'],
  environment:['Nhiệt độ hoặc độ ẩm phòng vượt ngưỡng','Nguồn điện không ổn định'],
  unknown:['Chưa xác định được nguyên nhân, tiếp tục theo dõi']
};
/* Hành động khắc phục gợi theo loại sai số, bám đúng hướng SE/RE mà fixHint() trong
   core.js đã phân sẵn chứ không tự đặt ra một cách phân loại thứ hai. */
const ACT_SUGGEST_ACTION={
  SE:['Hiệu chuẩn lại và xác nhận bằng QC','Thay lô hóa chất hoặc calibrator','Vệ sinh và bảo trì bộ phận liên quan','Cập nhật Mean/SD sau khi ổn định'],
  RE:['Vệ sinh kim hút, loại bọt khí','Thay lọ QC mới, trộn đều đúng cách','Đào tạo lại thao tác cho nhân viên','Kiểm tra nguồn điện và độ ổn định máy'],
  '':['Hiệu chuẩn lại và xác nhận bằng QC','Vệ sinh kim hút, loại bọt khí','Thay lọ QC mới, trộn đều đúng cách','Đào tạo lại thao tác cho nhân viên']
};
function actionCausePhrases(category){return ACT_SUGGEST_CAUSE[category]||[].concat(...Object.values(ACT_SUGGEST_CAUSE)).slice(0,4);}
function actionActionPhrases(errorType){return ACT_SUGGEST_ACTION[String(errorType||'').slice(0,2)]||ACT_SUGGEST_ACTION[''];}
/* Chip không dùng btn(): đây không phải nút hành động teal/ghost/danger mà là một
   affordance riêng, cùng kiểu với tab lọc trạng thái ở dashboard. */
function actionSuggestRow(targetId,phrases){
  if(!phrases||!phrases.length)return'';
  return `<div class="sugg-row" id="sugg-${escAttr(targetId)}">${phrases.map(p=>`<button type="button" class="sugg-chip" onclick="actionInsertSuggestion('${jsq(targetId)}','${jsq(p)}')">${esc(p)}</button>`).join('')}</div>`;
}
function actionSuggestBox(targetId,phrases,label='Gợi ý nhập nhanh'){
  if(!phrases||!phrases.length)return'';
  return `<details class="action-suggestions"><summary>+ ${esc(label)}</summary>${actionSuggestRow(targetId,phrases)}</details>`;
}
function actionInsertSuggestion(targetId,phrase){
  const e=document.getElementById(targetId);if(!e)return;
  const cur=String(e.value||'').trim();
  e.value=cur?(cur.endsWith('.')||cur.endsWith(';')?cur+' '+phrase:cur+'; '+phrase):phrase;
  e.dispatchEvent(new Event('input',{bubbles:true}));
  e.focus();e.setSelectionRange(e.value.length,e.value.length);
}
/* Đổi nhóm nguyên nhân / loại sai số thì vẽ lại đúng hàng chip liên quan, không
   rerender cả trang (sẽ giật và mất vị trí con trỏ). */
function syncActionSuggestions(){
  const cause=document.getElementById('sugg-aCause'),act=document.getElementById('sugg-aAct');
  if(cause)cause.outerHTML=actionSuggestRow('aCause',actionCausePhrases(actionFieldValue('aCauseCategory',40)));
  if(act)act.outerHTML=actionSuggestRow('aAct',actionActionPhrases(actionFieldValue('aErr',80)));
}
/* Giá trị lạ (hồ sơ cũ, ví dụ errorType 'Quản lý dữ liệu QC') được thêm thành một option
   riêng thay vì rơi im lặng về option đầu tiên rồi bị ghi đè khi lưu. */
function actSel(id,label,list,cur,extra=''){
  const v=cur==null?'':String(cur),opts=list.some(o=>o[0]===v)||!v?list:[...list,[v,v]];
  return `<select id="${id}" aria-label="${escAttr(label)}" ${extra}>${opts.map(([value,text])=>`<option value="${escAttr(value)}" ${value===v?'selected':''}>${esc(text)}</option>`).join('')}</select>`;
}
function actionLevelLabel(l,t=null){
  if(!l)return 'Mức ?';
  const lot=l.lot?` · Lô ${l.lot}`:' · Chưa có lô';
  const range=` · Mean ${fmtTestValue(t,l.mean)} · SD ${fmtTestStat(t,l.sd)}`;
  const band=l.applied?` · ${l.applied==='lab'?'PXN':'NSX'}`:'';
  return `Mức ${l.level}${lot}${range}${band}`;
}
/* Chỉ chạy cho hồ sơ MỚI — khi sửa, ô "Xét nghiệm" bị disabled và addAction() lấy
   testId/level/lot thẳng từ bản ghi nên hàm này không đụng tới được. */
function syncActLevels(){
  const testEl=document.getElementById('aTest'),levelEl=document.getElementById('aLevel'),labelEl=document.getElementById('aLevelLabel');
  if(!testEl||!levelEl)return;
  const t=state.tests.find(x=>x.id===testEl.value);
  if(!t)return;
  const levels=operationalLevels(t),l=levels.find(x=>String(x.level)===String(levelEl.value))||levels[0];
  if(l)levelEl.value=l.level;
  if(labelEl)labelEl.value=l?actionLevelLabel(l,t):'';
}
/* Ngữ cảnh hiển thị khi sửa: ưu tiên số lô ĐÃ GHI trong hồ sơ, không lấy lô hiện hành
   của mức (lô có thể đã chuyển tiếp từ lúc xảy ra sự cố). */
function actionLevelContext(testId,level,lot){
  const t=state.tests.find(x=>x.id===testId),l=t&&lvlCfg(t,+level);
  if(lot)return `Mức ${level} · Lô ${lot} (đã ghi nhận)`;
  return l?actionLevelLabel(l,t):`Mức ${level||'?'} · Chưa có lô`;
}
/* Nguồn ngoài IQC (EQA, cảnh báo thiết bị, phản hồi lâm sàng, đánh giá/audit) không
   bao giờ xuất hiện ở "Sự cố cần xử lý" vì không phải vi phạm Westgard — nhưng vẫn là
   sự không phù hợp phải lập hồ sơ. Đây là đường vào có chủ đích cho chúng, tách khỏi
   đường chính đi từ một vi phạm cụ thể. */
function beginActionManual(){
  if(!requireWrite())return;
  actionEditId='';actionSeed={manual:true};clearActionDraft();actionOpenSections=null;rerender();
  const e=document.getElementById('aCorrection');if(e)e.focus();
}
function closeActionForm(){actionEditId='';actionSeed=null;clearActionDraft();actionOpenSections=null;rerender();}
/* Dải nhận diện đặt ngay đầu form: trước đây form luôn bung sẵn và không nói đang lập
   hồ sơ cho sự cố nào, nên mở lên là mất phương hướng. */
/* Trạng thái đóng: nói rõ hai đường vào thay vì để một form trống lơ lửng. */
function actionFormClosedHtml(issueCount){
  const manual=canWrite()?btn('Lập hồ sơ từ nguồn khác','beginActionManual()','ghost'):'';
  return issueCount
    ?emptyState('Chọn một sự cố để lập hồ sơ',`Có ${issueCount} sự cố ở trên — bấm "Lập hồ sơ" ngay trên dòng cần xử lý để hồ sơ được gắn đúng điểm QC và tự theo dõi QC chạy lại.`,manual)
    :emptyState('Không có vi phạm nào cần lập hồ sơ','Hồ sơ NCE thường bắt đầu từ một vi phạm ở trên. Nếu sự không phù hợp đến từ EQA, cảnh báo thiết bị, phản hồi lâm sàng hay đánh giá nội bộ thì mở hồ sơ thủ công.',manual);
}
/* Dải nhận diện chỉ xuất hiện khi có ĐIỂM QC THẬT để nhận diện. Hồ sơ nguồn ngoài IQC
   chưa gắn điểm nào thì không có gì để nói: bản trước hiện "không gắn với điểm QC nào"
   rồi lại liệt kê Mean/SD/lô của xét nghiệm đầu dropdown mà người dùng chưa hề chọn —
   vừa thừa vừa tự mâu thuẫn. Việc hồ sơ đó không cần QC chạy lại vẫn đọc được ở phiếu
   chi tiết (bước 6 hiện "Không yêu cầu"). */
function actionIncidentBanner(form,editing){
  const p=form.pointId?((state.data&&state.data[form.testId])||[]).find(x=>x.id===form.pointId):null;
  if(!p)return'';
  const t=state.tests.find(x=>x.id===form.testId);
  const title=editing?`Đang tiếp tục hồ sơ ${editing.nceId||'NCE'}`:'Đang lập hồ sơ cho vi phạm này';
  const bits=[];
  if(t)bits.push(`${testDisplayName(t)} · ${actionLevelContext(form.testId,form.level,form.lot)}`);
  bits.push(`${vnDate(p.date)} · ${fmtPointValue(p,t)} ${t&&t.unit||''} · ${form.rule||'—'}`);
  return `<div class="action-incident-banner"><b>${esc(title)}</b><div>${bits.map(esc).join(' · ')}</div></div>`;
}
function beginActionFromIssue(tid,level,rule,err,act,pointId='',pointDate=''){
  actionEditId='';
  actionSeed={testId:tid,level,rule,errorType:err==='—'?'':err,pointId,date:pointDate||isoToday()};clearActionDraft();actionOpenSections=null;
  rerender();
  const e=document.getElementById('aCorrection');if(e)e.focus();
}
function actionFieldValue(id,max=5000){return QCCore.cleanText((document.getElementById(id)||{}).value,max).trim();}
function readActionProtocolForm(version=3){
  return{protocolVersion:version,eventSource:actionFieldValue('aEventSource',40),processPhase:actionFieldValue('aProcessPhase',40),correction:actionFieldValue('aCorrection'),dueDate:parseVN(actionFieldValue('aDueDate',40))||'',riskSeverity:+actionFieldValue('aRiskSeverity',4)||0,riskOccurrence:+actionFieldValue('aRiskOccurrence',4)||0,riskDetectability:+actionFieldValue('aRiskDetectability',4)||0,riskLevel:actionFieldValue('aRiskLevel',40),riskBasis:actionFieldValue('aRiskBasis'),containmentStatus:actionFieldValue('aContainment',40),containmentNote:actionFieldValue('aContainmentNote'),qcMaterialStatus:actionFieldValue('aQcMaterial',40),qcMaterialNote:actionFieldValue('aQcMaterialNote'),instrumentStatus:actionFieldValue('aInstrument',40),instrumentNote:actionFieldValue('aInstrumentNote'),reagentStatus:actionFieldValue('aReagent',40),reagentNote:actionFieldValue('aReagentNote'),calibrationStatus:actionFieldValue('aCalibration',40),calibrationNote:actionFieldValue('aCalibrationNote'),lotToLotStatus:actionFieldValue('aLotToLot',40),lotToLotNote:actionFieldValue('aLotToLotNote'),causeCategory:actionFieldValue('aCauseCategory',40),cause:actionFieldValue('aCause'),actionCompletedDate:parseVN(actionFieldValue('aActionCompletedDate',40))||'',biasBefore:actionFieldValue('aBiasBefore',20),biasAfter:actionFieldValue('aBiasAfter',20),releaseStatus:actionFieldValue('aReleaseStatus',40),releaseDate:parseVN(actionFieldValue('aReleaseDate',40))||'',releaseBy:actionFieldValue('aReleaseBy',120),releaseNote:actionFieldValue('aReleaseNote'),patientImpact:actionFieldValue('aPatientImpact',40),patientAction:actionFieldValue('aPatientAction'),effectivenessStatus:actionFieldValue('aEffectivenessStatus',40)||'pending',effectivenessDate:parseVN(actionFieldValue('aEffectivenessDate',40))||'',effectivenessNote:actionFieldValue('aEffectivenessNote'),residualSeverity:+actionFieldValue('aResidualSeverity',4)||0,residualOccurrence:+actionFieldValue('aResidualOccurrence',4)||0,residualDetectability:+actionFieldValue('aResidualDetectability',4)||0,residualRiskLevel:actionFieldValue('aResidualRiskLevel',40),residualRiskBasis:actionFieldValue('aResidualRiskBasis')};
}
function actionEffectivenessMissingKey(a){
  if(globalThis.ActionProtocolService)return globalThis.ActionProtocolService.effectivenessMissingKey(a);
  if(+a.protocolVersion>=3&&!a.actionCompletedDate)return'actionCompletedDate';
  if(!a.effectivenessDate)return'effectivenessDate';
  if(String(a.effectivenessNote||'').trim().length<5)return'effectivenessNote';
  const rerun=actionNeedsRerun(a)?actionRerunStatus(a):null,earliest=[a.date,a.actionCompletedDate,a.releaseDate,rerun&&rerun.ok&&rerun.point&&rerun.point.date].filter(Boolean).sort().pop();
  if(a.effectivenessDate>isoToday()||(earliest&&a.effectivenessDate<earliest))return'effectivenessDate';
  if(a.effectivenessStatus==='effective'&&+a.protocolVersion>=3){
    if(!RISK_SCALE.includes(+a.residualSeverity))return'residualSeverity';
    if(!RISK_SCALE.includes(+a.residualOccurrence))return'residualOccurrence';
    if(!RISK_SCALE.includes(+a.residualDetectability))return'residualDetectability';
    if(!ACTION_LABELS.risk[a.residualRiskLevel])return'residualRiskLevel';
    if(String(a.residualRiskBasis||'').trim().length<5)return'residualRiskBasis';
    const initial=actionRiskScore(a),residual=actionResidualRiskScore(a);
    if(initial&&residual>initial)return'residualSeverity';
  }
  return'effectivenessNote';
}
async function addAction(){
  if(!requireWrite())return;state.actions=state.actions||[];
  const editing=actionEditId&&(state.actions||[]).find(a=>a.id===actionEditId);
  /* Danh tính sự cố (xét nghiệm / mức / lô / điểm QC) là ẢNH CHỤP lúc mở hồ sơ, không
     đọc lại từ form khi sửa: đổi ô "Xét nghiệm" từng làm actionPoint() trả null, khiến
     yêu cầu QC chạy lại biến mất và hồ sơ duyệt được mà không có bằng chứng chạy lại;
     còn lấy lại lot theo lvlCfg() hiện hành thì ghi đè số lô của sự cố sau mỗi lần
     chuyển lô. */
  const tid=editing?editing.testId:document.getElementById('aTest').value,t=state.tests.find(x=>x.id===tid);
  const levelEl=document.getElementById('aLevel');
  const level=editing?editing.level:(levelEl?parseInt(levelEl.value)||0:0),l=t&&level?lvlCfg(t,level):null;
  const lot=editing?(editing.lot||''):(l&&l.lot||''),pointId=editing?(editing.pointId||''):actionFieldValue('aPointId',80);
  const rule=actionFieldValue('aRule'),action=actionFieldValue('aAct'),by=actionFieldValue('aBy'),errorType=actionFieldValue('aErr'),nceId=actionFieldValue('aNceId',80)||nextNceId(isoToday()),date=parseVN(document.getElementById('aDate').value)||isoToday(),protocol=readActionProtocolForm(editing?Math.max(2,+editing.protocolVersion||2):3);
  const candidate={...(editing||{}),...protocol,testId:tid,level,lot,pointId,date,action,by},draft=actionDraftStatus(candidate);
  if(!draft.complete){await infoDialog('Còn thiếu để mở hồ sơ: '+draft.missing.join('; ')+'.');focusActionField((draft.missingKeys||[])[0]);return;}
  if(protocol.dueDate&&protocol.dueDate<date){await infoDialog('Hạn hoàn thành không được trước ngày ghi nhận sự cố.');focusActionField('dueDate');return;}
  if(protocol.actionCompletedDate&&(protocol.actionCompletedDate<date||protocol.actionCompletedDate>isoToday())){await infoDialog(protocol.actionCompletedDate<date?'Ngày hoàn thành hành động không được trước ngày ghi nhận sự cố.':'Ngày hoàn thành hành động không được ở tương lai.');focusActionField('actionCompletedDate');return;}
  if(protocol.effectivenessStatus!=='pending'){const eff=actionEffectivenessStatus(candidate);if(!eff.complete){await infoDialog(eff.label+'.');focusActionField(actionEffectivenessMissingKey(candidate));return;}}
  if(editing){
    if(actionCancelled(editing)){await infoDialog('Hồ sơ đã hủy được giữ nguyên để bảo toàn dấu vết và không thể chỉnh sửa. Hãy lập hồ sơ NCE mới nếu sự cố vẫn cần xử lý.');return;}
    if(actionApprovalStatus(editing)==='approved'){await infoDialog('Hồ sơ đã khép vòng không được sửa. Nếu phát hiện vấn đề tái diễn, hãy mở một hồ sơ NCE mới.');return;}
    const saved=ActionRecordService.update(editing,{nceId:editing.nceId||nceId,date,rule,errorType,action,by,...protocol},{id:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',name:userName()});
    if(!saved)return;
    logAct('Cập nhật hồ sơ NCE',`${editing.nceId||'NCE'} · ${actionWorkflowStatus(editing).label}`,t?t.name:'');actionEditId='';
  }else{
    const record=ActionRecordService.create(state.actions,{nceId,date,testId:tid,level,lot,pointId,rule,errorType,action,by,...protocol},{id:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',name:userName()});
    logAct('Lập hồ sơ NCE',`${record.nceId} · ${actionLevelShort(t,level,lot)} · đang điều tra`,t?t.name:'');
  }
  actionSeed=null;clearActionDraft();actionOpenSections=null;save({clearDerived:false});rerender();
}
function syncActionRiskScore(){
  const a={riskSeverity:+actionFieldValue('aRiskSeverity',4)||0,riskOccurrence:+actionFieldValue('aRiskOccurrence',4)||0,riskDetectability:+actionFieldValue('aRiskDetectability',4)||0},e=document.getElementById('aRiskScore'),card=document.getElementById('aRiskScoreCard'),score=actionRiskScore(a),level=actionFieldValue('aRiskLevel',40);
  if(e)e.textContent=score?String(score):'—';
  if(card)card.className=`action-risk-score risk-${['low','medium','high','critical'].includes(level)?level:'none'}`;
}
function syncActionResidualRiskScore(){
  const a={residualSeverity:+actionFieldValue('aResidualSeverity',4)||0,residualOccurrence:+actionFieldValue('aResidualOccurrence',4)||0,residualDetectability:+actionFieldValue('aResidualDetectability',4)||0},e=document.getElementById('aResidualRiskScore'),card=document.getElementById('aResidualRiskScoreCard'),score=actionResidualRiskScore(a),level=actionFieldValue('aResidualRiskLevel',40);
  if(e)e.textContent=score?String(score):'—';
  if(card)card.className=`action-risk-score risk-${['low','medium','high','critical'].includes(level)?level:'none'}`;
}
async function editAction(i){
  const a=state.actions&&state.actions[i];if(!a)return;
  if(actionCancelled(a)){await infoDialog('Hồ sơ đã hủy được giữ nguyên để bảo toàn dấu vết và không thể chỉnh sửa.');return;}
  if(actionApprovalStatus(a)==='approved'){await infoDialog('Hồ sơ đã khép vòng không được sửa. Nếu vấn đề tái diễn, hãy mở hồ sơ NCE mới.');return;}
  actionEditId=a.id;actionSeed=null;clearActionDraft();actionOpenSections=null;rerender();
  const panel=document.querySelector('.action-form-panel');if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function actionInvestigationField(statusId,noteId,title,hint,form,statusKey,noteKey,lotToLot=false){
  const value=String(form[statusKey]||''),choices=(lotToLot?ACT_LOT2LOT_OPTS:ACT_CHECK_OPTS).filter(([v])=>v),stateCls=actionInvestigationStateClass(value),stateLabel=ACTION_LABELS.check[value]||'Chưa kết luận';
  return `<div class="action-investigation-item ${stateCls}" id="check-${escAttr(statusId)}"><div class="action-investigation-head"><div><b>${esc(title)}</b><small>${esc(hint)}</small></div><span class="action-investigation-state">${esc(stateLabel)}</span></div>
    <select id="${statusId}" class="action-investigation-select" aria-hidden="true" tabindex="-1" onchange="actionInvestigationSync('${jsq(statusId)}')">${(lotToLot?ACT_LOT2LOT_OPTS:ACT_CHECK_OPTS).map(([v,label])=>`<option value="${escAttr(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('')}</select>
    <div class="action-investigation-choices" role="group" aria-label="${escAttr('Kết quả '+title)}">${choices.map(([v,label])=>`<button type="button" class="action-choice ${v===value?'active':''}" data-value="${escAttr(v)}" aria-pressed="${v===value?'true':'false'}" onclick="actionInvestigationChoose('${jsq(statusId)}','${jsq(v)}')">${esc(actionInvestigationChoiceLabel(v,label))}</button>`).join('')}</div>
    <div class="action-investigation-note"><input id="${noteId}" aria-label="Ghi chú ${escAttr(title)}" placeholder="Ghi chú / bằng chứng" value="${escAttr(form[noteKey]||'')}">${actionSuggestBox(noteId,ACT_SUGGEST[noteKey],'Gợi ý bằng chứng')}</div></div>`;
}
function actionInvestigationChoiceLabel(value,label){return globalThis.ActionInvestigationPresentation?globalThis.ActionInvestigationPresentation.choiceLabel(value,label):value==='not-needed'?'Không cần':value==='checked-ok'?'Đạt':value==='checked-abnormal'?'Bất thường':label;}
function actionInvestigationStateClass(value){return globalThis.ActionInvestigationPresentation?globalThis.ActionInvestigationPresentation.stateClass(value):['ok','checked-ok'].includes(value)?'is-ok':['abnormal','checked-abnormal'].includes(value)?'is-abnormal':['na','not-needed'].includes(value)?'is-na':'is-empty';}
function actionInvestigationChoose(statusId,value){
  const select=document.getElementById(statusId);if(!select)return;
  select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
  if(['abnormal','checked-abnormal','na'].includes(value)){const card=select.closest('.action-investigation-item'),note=card&&card.querySelector('.action-investigation-note input');if(note)note.focus();}
}
function actionInvestigationSync(statusId){
  const select=document.getElementById(statusId),card=select&&select.closest('.action-investigation-item');if(!select||!card)return;
  card.classList.remove('is-empty','is-ok','is-abnormal','is-na');card.classList.add(actionInvestigationStateClass(select.value));
  card.querySelectorAll('.action-choice').forEach(button=>{const active=button.dataset.value===select.value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active?'true':'false');});
  const label=card.querySelector('.action-investigation-state');if(label)label.textContent=ACTION_LABELS.check[select.value]||'Chưa kết luận';
}
function actionChecklistRefresh(){
  const first=document.getElementById(ACT_CHECK_FIELDS[0][0]),section=first&&first.closest('details'),chip=section&&section.querySelector(':scope > summary .action-chip');if(!chip)return;
  const rows=ACT_CHECK_FIELDS.map(([statusId,noteId])=>({status:(document.getElementById(statusId)||{}).value,note:(document.getElementById(noteId)||{}).value})),info=globalThis.ActionChecklistPresentation?globalThis.ActionChecklistPresentation.checklistChip(rows):(function(){const done=rows.filter(({status,note})=>{const valid=!!ACTION_LABELS.check[status],needNote=['abnormal','na','checked-abnormal'].includes(status);return valid&&(!needNote||String(note||'').trim().length>=3);}).length;return{cls:done===rows.length?'ok':'warn',label:`Đã hoàn tất ${done}/${rows.length}`};})();
  chip.textContent=info.label;chip.classList.toggle('ok',info.cls==='ok');chip.classList.toggle('warn',info.cls==='warn');
}
/* Bọc một mục thành <details> thu gọn được. Dùng thẻ gốc thay vì tự dựng bằng JS:
   bàn phím, ARIA và trạng thái mở/đóng do trình duyệt lo, không phát sinh vi phạm
   a11y nào. ontoggle ghi lại trạng thái để rerender() không bung/thu lung tung. */
function actionSectionChip(missing){
  if(globalThis.ActionChecklistPresentation)return globalThis.ActionChecklistPresentation.sectionChip(missing);
  const n=(missing||[]).length;
  return n?{cls:'warn',label:`Còn thiếu ${n} mục`,title:`Còn thiếu: ${missing.join('; ')}`}:{cls:'ok',label:'Đã xong',title:'Không còn mục bắt buộc chưa hoàn thành'};
}
function actionChecklistChip(form){
  if(globalThis.ActionChecklistPresentation)return globalThis.ActionChecklistPresentation.checklistChip(ACT_CHECK_FIELDS.map(([, ,statusKey,noteKey])=>({status:form[statusKey],note:form[noteKey]})));
  const done=ACT_CHECK_FIELDS.filter(([, ,statusKey,noteKey])=>{const status=form[statusKey],valid=!!ACTION_LABELS.check[status],needNote=['abnormal','na','checked-abnormal'].includes(status);return valid&&(!needNote||String(form[noteKey]||'').trim().length>=3);}).length;
  return{cls:done===ACT_CHECK_FIELDS.length?'ok':'warn',label:`Đã hoàn tất ${done}/${ACT_CHECK_FIELDS.length}`};
}
/* Mục 8 không nằm trong checklist khép vòng nên không có số "còn thiếu" — chip lấy
   thẳng từ cổng hiệu lực, nếu không sẽ luôn hiện "Đã xong" cho hồ sơ còn trắng. */
function actionEffSectionChip(form){
  if(globalThis.ActionChecklistPresentation)return globalThis.ActionChecklistPresentation.effectivenessChip(form);
  const eff=actionEffectivenessStatus({...form,protocolVersion:form.protocolVersion||3});
  return{cls:eff.cls==='none'?'none':eff.cls,label:eff.complete?eff.label:(form.effectivenessStatus==='ineffective'?eff.label:'Chưa đánh giá'),title:eff.label};
}
function actionUpdateSectionChip(key,info){
  const section=document.querySelector(`details[data-action-section="${key}"]`),chip=section&&section.querySelector(':scope > summary .action-chip');if(!chip)return;
  chip.className=`action-chip ${info.cls}`;chip.textContent=info.label;chip.title=info.title||'';chip.setAttribute('aria-label',info.title||info.label);
}
function actionRefreshSectionChips(){
  if(!document.getElementById('aCorrection'))return;
  const editing=actionEditId&&(state.actions||[]).find(a=>a.id===actionEditId),version=editing?Math.max(2,+editing.protocolVersion||2):3;
  const form={...(editing||{}),...readActionProtocolForm(version),protocolVersion:version,testId:editing?editing.testId:actionFieldValue('aTest',80),date:parseVN(actionFieldValue('aDate',40))||'',action:actionFieldValue('aAct'),by:actionFieldValue('aBy'),pointId:actionFieldValue('aPointId',80)};
  const miss=actionProtocolStatus(form).missingBySection||{};
  ['immediate','risk','cause','patient'].forEach(key=>actionUpdateSectionChip(key,actionSectionChip(miss[key])));
  actionUpdateSectionChip('eff',actionEffSectionChip(form));actionChecklistRefresh();
}
function actionSection(key,badge,title,hint,bodyHtml,chipInfo,openSet){
  const open=openSet.has(key),chip=`<span class="action-chip ${chipInfo.cls}" aria-label="${escAttr(chipInfo.title||chipInfo.label)}"${chipInfo.title?` title="${escAttr(chipInfo.title)}"`:''}>${esc(chipInfo.label)}</span>`;
  return `<details class="action-form-section" data-action-section="${escAttr(key)}" ${open?'open':''} ontoggle="actionSectionToggled('${jsq(key)}',this.open)">
     <summary class="action-form-section-title"><span>${esc(badge)}</span><div><b>${esc(title)}</b><small>${esc(hint)}</small></div>${chip}</summary>
     ${bodyHtml}</details>`;
}
/* Giá trị khởi tạo của form: bản ghi đang sửa > seed từ vi phạm vừa bấm "Ghi nhận" >
   mặc định cho hồ sơ mới. Trả về object phẳng để mọi ô render được value/selected. */
function actionFormModel(editing,tests){
  const base=editing?{...editing,effectivenessStatus:editing.effectivenessStatus||'pending'}:actionFormDefaults(tests);
  const draft=actionDraftValues();
  if(!draft)return base;
  /* Bản nháp chỉ đè lên các ô có trên form — lot/testId của hồ sơ đang sửa vẫn là ảnh
     chụp lúc mở hồ sơ vì không nằm trong ACT_FIELDS hoặc vì ô đó bị khoá. */
  const out={...base};
  ACT_FIELDS.forEach(([id,key,kind])=>{if(id in draft)out[key]=kind==='num'?(+draft[id]||0):draft[id];});
  return out;
}
/* Hồ sơ mở từ nút "Lập hồ sơ từ nguồn khác" KHÔNG được bịa ra danh tính QC: không có
   điểm QC nào thì xét nghiệm/mức/lô đều chưa xác định, mà bản trước lại lặng lẽ điền
   xét nghiệm đầu dropdown và Mức 1 của nó. Nguồn phát hiện cũng để trống thay vì mặc
   định "Nội kiểm IQC" — người dùng vừa bấm đúng nút nói rằng đây KHÔNG phải IQC. */
function actionFormDefaults(tests){
  const firstTest=tests[0],seed=actionSeed||{},manual=!!seed.manual;
  const testId=manual?'':(seed.testId||(firstTest&&firstTest.id)||''),t=state.tests.find(x=>x.id===testId);
  const levels=t?operationalLevels(t):[];
  const level=manual?'':(levels.some(l=>String(l.level)===String(seed.level))?seed.level:(levels[0]&&levels[0].level)||'');
  return{protocolVersion:3,testId,level,lot:'',date:seed.date||isoToday(),rule:seed.rule||'',errorType:seed.errorType||'',pointId:seed.pointId||'',
    by:currentUser?(currentUser.name||currentUser.username):'',dueDate:nceDueDate(7),
    eventSource:manual?'':'iqc',processPhase:'exam',effectivenessStatus:'pending'};
}
/* Đưa con trỏ tới đúng ô còn thiếu thay vì chỉ hiện hộp thoại: nhãn "xử lý tức thời"
   nằm ở cuối mục 1, cách xa nút Lưu ở cuối trang. */
function focusActionField(key){
  const entry=ACT_FIELDS.find(f=>f[1]===key),e=entry&&document.getElementById(entry[0]);
  if(!e)return;
  /* Ô có thể nằm trong một mục đang thu gọn — mở ra trước, không thì cuộn tới chỗ trống. */
  const box=e.closest('details');if(box&&!box.open)box.open=true;
  const target=e.classList.contains('action-investigation-select')?e.closest('.action-investigation-item'):e,focusTarget=e.classList.contains('action-investigation-select')&&target?target.querySelector('.action-choice'):e;
  target.scrollIntoView({behavior:'smooth',block:'center'});if(focusTarget)focusTarget.focus({preventScroll:true});target.classList.add('field-invalid');
  const drop=()=>{target.classList.remove('field-invalid');e.removeEventListener('input',drop);e.removeEventListener('change',drop);};
  e.addEventListener('input',drop);e.addEventListener('change',drop);
}
/* Bias trước/sau khắc phục (mục 4-6) và số tham khảo ΔSEcrit/ΔREcrit (mục 7) — thuần,
   không đụng DOM/state, nhận t/l đã tra sẵn để render lẫn refresh dùng chung một nguồn
   tính toán. Cố ý dùng HAI bias khác việc: "sau khắc phục" trả lời "đã sửa xong chưa"
   (mục 4-6, so với ngưỡng TEa/4); "trước khắc phục" trả lời "lúc sự cố xảy ra nặng cỡ
   nào" (mục 7, đưa vào ΔSEcrit/ΔREcrit) — dùng nhầm biasAfter cho mục 7 sẽ luôn ra
   "nguy cơ thấp" giả vì Bias sau khắc phục gần như luôn nhỏ theo định nghĩa.
   raw rỗng/không phải số KHÔNG được rơi về 0: 0% bias là một kết quả hợp lệ (đạt),
   khác hẳn "chưa đo lại" — cùng loại lỗi finiteNumber(v,0) đã sửa ở
   ReagentComparisonService.updateMetadata() trong phiên này (biasTarget/alpha). */
function actionBiasInfo(t,l,biasBeforeRaw,biasAfterRaw){
  return ActionBiasService.info(t,l,biasBeforeRaw,biasAfterRaw);
}
/* t/l cho actionBiasInfo(): hồ sơ đang sửa dùng đúng testId/level đã khóa (editing),
   hồ sơ mới đọc theo ô đang chọn trên form — giống cách syncActLevels() tra levels. */
function actionBiasContext(form,editing){
  const testId=editing?editing.testId:form.testId,level=editing?editing.level:form.level;
  const t=state.tests.find(x=>x.id===testId),l=t&&level?lvlCfg(t,+level):null;
  return{t,l};
}
/* Gợi ý Bias trước khắc phục từ kỳ Sigma gần nhất — CHÈN ĐƯỢC, không auto-fill:
   Bias EQA của Sigma là hiệu năng NỀN của xét nghiệm (kỳ gần nhất, RMS nhiều vòng),
   khác với "Bias trước khắc phục" của riêng sự cố này — người dùng có thể đúng là
   muốn dùng lại số đó, nhưng app không được tự ý ghi đè, giống mọi chip gợi ý khác
   trong form này (ACT_SUGGEST). sgBiasVal (sigma.js) đã ưu tiên biasEqa rồi mới tới
   bias — lấy lại đúng logic đó, không tính RMS lần thứ hai ở đây. */
function actionLatestSigmaBias(t,level){
  return ActionBiasService.latestSigmaBias(t,level,state.sigmaData);
}
function actionFillBias(targetId,value){
  const e=document.getElementById(targetId);if(!e)return;
  e.value=fmt(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.focus();
}
function actionBiasThresholdHtml(info){
  return ActionBiasPresentation.thresholdHtml(info);
}
function actionBiasReferenceHtml(info){
  return ActionBiasPresentation.referenceHtml(info);
}
/* Gọi khi gõ Bias trước/sau: cập nhật cả hint ngưỡng ở mục 4-6 lẫn thẻ tham khảo ở
   mục 7 từ CÙNG một actionBiasInfo(), tránh hai nơi tính lệch nhau. */
function actionUpdateBiasHint(){
  const editing=actionEditId&&(state.actions||[]).find(a=>a.id===actionEditId);
  const testId=editing?editing.testId:actionFieldValue('aTest',80),level=editing?editing.level:(document.getElementById('aLevel')||{}).value;
  const t=state.tests.find(x=>x.id===testId),l=t&&level?lvlCfg(t,+level):null;
  const info=actionBiasInfo(t,l,actionFieldValue('aBiasBefore',20),actionFieldValue('aBiasAfter',20));
  const thr=document.getElementById('aBiasThresholdHint');if(thr)thr.innerHTML=actionBiasThresholdHtml(info);
  const ref=document.getElementById('aPatientRiskRef');if(ref)ref.innerHTML=actionBiasReferenceHtml(info);
}
/* Panel lập hồ sơ NCE tách khỏi pageActionsV4() (2026-07-30): trước đó cả form 8 mục,
   danh sách sự cố và bảng nhật ký nằm chung MỘT hàm 17 KB, nên không đọc được phần nào
   thuộc về đâu. Ranh giới đã kiểm chứng: mọi biến dựng ở đây (editing/form/openSet/
   qcBound/opts...) chỉ được dùng trong chính markup form, và phần form chỉ cần đúng một
   thứ từ bên ngoài — số sự cố đang chờ, nên nhận qua tham số issueCount thay vì tính lại
   currentIssues() lần thứ hai. */
function actionFormHtml(issueCount){
  const tests=operationalTests();
  const editing=actionEditId&&(state.actions||[]).find(a=>a.id===actionEditId),form=actionFormModel(editing,tests);
  const formAction=editing?{...editing,...form,testId:editing.testId,level:editing.level,lot:editing.lot||'',pointId:editing.pointId||''}:null,formRerun=formAction?actionRerunStatus(formAction):null;
  /* Form chỉ hiện khi thật sự đang làm MỘT hồ sơ cụ thể — mở từ một vi phạm, mở lại hồ
     sơ cũ, hoặc chủ động mở cho nguồn ngoài IQC. Trước đây nó luôn bung sẵn, không gắn
     với sự cố nào, nên vừa chiếm chỗ vừa khiến người dùng mất dấu đang xử lý cái gì. */
  const formOpen=!!(editing||actionSeed);
  /* Tinh tren FORM dang hien chu khong tren ban ghi da luu: dai tom tat phai phan anh
     nhung gi nguoi dung vua go, khong phai trang thai luc mo ho so. */
  const formProtocol=actionProtocolStatus({...form,protocolVersion:form.protocolVersion||3}),miss=formProtocol.missingBySection||{};
  const openSet=actionOpenSections||actionDefaultOpenSections(editing,formProtocol);
  /* Chỉ hồ sơ gắn một điểm QC thật mới có mức/lô. Hồ sơ nguồn ngoài IQC (EQA, thiết bị,
     lâm sàng, đánh giá) thì xét nghiệm là tùy chọn và không có ngữ cảnh QC nào cả. */
  const qcBound=!!(form.pointId&&((state.data&&state.data[form.testId])||[]).some(x=>x.id===form.pointId));
  const knownTest=tests.some(t=>t.id===form.testId),missingTest=!knownTest&&form.testId?state.tests.find(t=>t.id===form.testId):null;
  const opts=(qcBound?'':`<option value="" ${form.testId?'':'selected'}>— Không gắn xét nghiệm —</option>`)+
    (missingTest||(!knownTest&&form.testId)?`<option value="${escAttr(form.testId)}" selected>${esc(missingTest?testDisplayName(missingTest):'Xét nghiệm không còn vận hành')}</option>`:'')+
    tests.map(t=>`<option value="${escAttr(t.id)}" ${t.id===form.testId?'selected':''}>${esc(testDisplayName(t))}</option>`).join('');
  const {t:biasT,l:biasL}=actionBiasContext(form,editing),biasInfo=actionBiasInfo(biasT,biasL,form.biasBefore,form.biasAfter);
  const sigmaBias=actionLatestSigmaBias(biasT,editing?editing.level:form.level);
  const sigmaBiasChip=sigmaBias?`<div class="sugg-row"><button type="button" class="sugg-chip" onclick="actionFillBias('aBiasBefore',${sigmaBias.value})" title="Lấy từ Bias EQA/EQC kỳ ${escAttr(sigmaBias.period)} ở trang Six Sigma">Dùng Bias EQA gần nhất (kỳ ${esc(sigmaBias.period)}): ${fmt(sigmaBias.value)}%</button></div>`:'';
  return `<div class="panel action-form-panel"><div class="action-form-panel-head"><h2 class="panel-title">${editing?'Tiếp tục hồ sơ '+esc(editing.nceId||'NCE'):'Lập hồ sơ sự không phù hợp (NCE)'}</h2>${btn('Quy trình 8 bước','openActionGuide()','ghost sm')}</div>${!formOpen?actionFormClosedHtml(issueCount):`<div class="action-form-body" oninput="actionFormChanged()" onchange="actionFormChanged()">${actionIncidentBanner(form,editing)}<div class="action-form-section"><div class="action-form-section-title"><span>Hồ sơ</span><div><b>Nhận diện sự cố</b><small>Có thể lưu ngay sau khi kiểm soát tức thời; không cần chờ điều tra xong</small></div></div>
     <input id="aPointId" type="hidden" value="${escAttr(form.pointId||'')}">
     ${qcBound?`<input id="aLevel" type="hidden" value="${escAttr(form.level==null?'':form.level)}">`:''}
     <div class="action-ident-groups">
       <div class="action-ident-group"><div class="action-ident-group-title"><b>Đối tượng QC</b><small>${editing?'Khóa theo hồ sơ đã mở — sai đối tượng thì hủy có lưu vết và mở hồ sơ mới':'Hồ sơ và cấu hình QC đang xảy ra sự cố'}</small></div><div class="action-form-main">
         <div><label>Mã hồ sơ</label><input id="aNceId" aria-label="Mã hồ sơ NCE" readonly value="${escAttr(editing?(editing.nceId||nextNceId(isoToday())):nextNceId(isoToday()))}"></div>
         <div><label>Xét nghiệm${qcBound?'':' <span class="hint">(nếu có)</span>'}</label><select id="aTest" aria-label="Xét nghiệm" ${editing?'disabled':'onchange="syncActLevels()"'}>${opts}</select></div>
         ${qcBound?`<div><label>Ngữ cảnh QC</label><input id="aLevelLabel" aria-label="Ngữ cảnh QC" readonly value="${escAttr(actionLevelContext(form.testId,form.level,form.lot))}"></div>`:''}
       </div></div>
       <div class="action-ident-group"><div class="action-ident-group-title"><b>Phân loại sự cố</b><small>Thời điểm, dấu hiệu phát hiện và loại sai số</small></div><div class="action-form-meta">
         <div><label>Ngày ghi nhận</label>${dateBox('aDate',form.date||isoToday(),'action-date')}</div>
         <div><label>Luật vi phạm</label>${actSel('aRule','Luật vi phạm',actionRuleOptions(),form.rule)}</div>
         <div><label>Nguồn phát hiện</label>${actSel('aEventSource','Nguồn phát hiện',actionSourceOptions(qcBound,form.eventSource),form.eventSource||'')}</div>
         <div><label>Giai đoạn</label>${actSel('aProcessPhase','Giai đoạn quá trình',ACT_PHASE_OPTS,form.processPhase||'exam')}</div>
         <div><label>Loại sai số</label>${actSel('aErr','Loại sai số',ACT_ERR_OPTS,form.errorType,'onchange="syncActionSuggestions()"')}</div>
       </div></div>
       <div class="action-ident-group"><div class="action-ident-group-title"><b>Phân công xử lý</b><small>Người chịu trách nhiệm và thời hạn dự kiến</small></div><div class="action-form-owner">
         <div><label>Người phụ trách</label><input id="aBy" aria-label="Người phụ trách" list="aByList" autocomplete="off" placeholder="Chọn hoặc gõ tên" value="${escAttr(form.by||'')}"><datalist id="aByList">${actionStaffOptions()}</datalist></div>
         <div><label>Hạn hoàn thành</label>${dateBox('aDueDate',form.dueDate||'','action-date')}</div>
       </div></div>
     </div>${formAction?actionEvidenceTimelineHtml(formAction,formRerun):''}</div>
     ${actionSection('immediate','1','Kiểm soát và xử lý tức thời','Phần tối thiểu bắt buộc để mở hồ sơ NCE; kết luận ảnh hưởng bệnh nhân ghi ở mục 7',`<div class="action-immediate-grid"><div><label>Phạm vi kiểm soát tức thời</label>${actSel('aContainment','Phạm vi kiểm soát tức thời',ACT_CONTAIN_OPTS,form.containmentStatus)}</div><div><label>Ghi chú phạm vi</label><input id="aContainmentNote" placeholder="VD: Giữ kết quả từ 08:00 đến khi QC đạt" value="${escAttr(form.containmentNote||'')}">${actionSuggestBox('aContainmentNote',ACT_SUGGEST.containmentNote)}</div><div><label>Xử lý tức thời đã thực hiện</label><textarea id="aCorrection" rows="1" placeholder="VD: Dừng trả kết quả, cô lập lô QC và thông báo phụ trách...">${esc(form.correction||'')}</textarea>${actionSuggestBox('aCorrection',ACT_SUGGEST.correction)}</div></div>`,actionSectionChip(miss.immediate),openSet)}
     ${actionSection('risk','2','Đánh giá nguy cơ','RPN được tính tự động; mức phân loại phải truy xuất được về SOP của đơn vị',`<div class="action-risk-grid"><div><label>Mức độ ảnh hưởng (S)</label>${actSel('aRiskSeverity','Mức độ ảnh hưởng',ACT_SEVERITY_OPTS,form.riskSeverity,'onchange="syncActionRiskScore()"')}</div><div><label>Khả năng xảy ra (O)</label>${actSel('aRiskOccurrence','Khả năng xảy ra',ACT_OCCURRENCE_OPTS,form.riskOccurrence,'onchange="syncActionRiskScore()"')}</div><div><label>Khả năng không phát hiện (D)</label>${actSel('aRiskDetectability','Khả năng không phát hiện',ACT_DETECT_OPTS,form.riskDetectability,'onchange="syncActionRiskScore()"')}</div><div class="action-risk-level"><label>Phân loại theo SOP</label>${actSel('aRiskLevel','Phân loại nguy cơ',ACT_RISK_LEVEL_OPTS,form.riskLevel,'onchange="syncActionRiskScore()"')}</div><div class="action-risk-result"><label>RPN</label><div id="aRiskScoreCard" class="action-risk-score risk-${escAttr(['low','medium','high','critical'].includes(form.riskLevel)?form.riskLevel:'none')}" aria-live="polite"><b id="aRiskScore">${actionRiskScore(form)||'—'}</b></div></div><div class="action-risk-basis"><label>Căn cứ phân loại theo SOP</label><input id="aRiskBasis" placeholder="VD: SOP-QC-07, ma trận nguy cơ bảng 3" value="${escAttr(form.riskBasis||'')}">${actionSuggestBox('aRiskBasis',ACT_SUGGEST.riskBasis)}</div></div>`,actionSectionChip(miss.risk),openSet)}
     ${actionSection('check','3','Checklist điều tra','Ghi rõ khi bất thường hoặc không áp dụng',`<div class="action-investigation-grid">
       ${actionInvestigationField('aQcMaterial','aQcMaterialNote','Vật liệu QC','Hạn dùng, bảo quản, hoàn nguyên',form,'qcMaterialStatus','qcMaterialNote')}
       ${actionInvestigationField('aInstrument','aInstrumentNote','Máy phân tích','Điện, nước, nhiệt độ, cảnh báo, bảo trì',form,'instrumentStatus','instrumentNote')}
       ${actionInvestigationField('aReagent','aReagentNote','Hóa chất / calibrator','Hạn dùng, số lô và điều kiện bảo quản',form,'reagentStatus','reagentNote')}
       ${actionInvestigationField('aCalibration','aCalibrationNote','Hiệu chuẩn','Tình trạng và chỉ định tái hiệu chuẩn',form,'calibrationStatus','calibrationNote')}
       ${actionInvestigationField('aLotToLot','aLotToLotNote','So sánh lot-to-lot','Dùng khi có thay đổi lô gần đây',form,'lotToLotStatus','lotToLotNote',true)}
     </div>`,actionChecklistChip(form),openSet)}
      ${actionSection('cause','4–6','Nguyên nhân gốc và hành động khắc phục','Tách khỏi xử lý tức thời; QC chạy lại được tự liên kết',`<div class="action-cause-grid"><div><label>Nhóm nguyên nhân</label>${actSel('aCauseCategory','Nhóm nguyên nhân',ACT_CAUSE_OPTS,form.causeCategory,'onchange="syncActionSuggestions()"')}</div><div><label>Nguyên nhân gốc hoặc nghi ngờ</label><textarea id="aCause" rows="1" placeholder="Mô tả bằng chứng và nguyên nhân...">${esc(form.cause||'')}</textarea>${actionSuggestBox('aCause',actionCausePhrases(form.causeCategory))}</div><div><label>Hành động khắc phục để ngăn tái diễn</label><textarea id="aAct" rows="1" placeholder="VD: Thay lọ QC mới, vệ sinh kim hút, cập nhật lịch bảo trì...">${esc(form.action||'')}</textarea>${actionSuggestBox('aAct',actionActionPhrases(form.errorType))}</div></div><div class="action-cause-second-row"><div><label>Ngày hoàn thành hành động</label>${dateBox('aActionCompletedDate',form.actionCompletedDate||'','action-date')}</div><div><label>Bias trước khắc phục (%) <small class="hint">tham khảo</small></label><input id="aBiasBefore" type="text" inputmode="decimal" placeholder="VD: 8.5" value="${escAttr(form.biasBefore||'')}" oninput="actionUpdateBiasHint()">${sigmaBiasChip}</div><div><label>Bias sau khắc phục (%) <small class="hint">tham khảo</small></label><input id="aBiasAfter" type="text" inputmode="decimal" placeholder="VD: 1.2" value="${escAttr(form.biasAfter||'')}" oninput="actionUpdateBiasHint()"></div></div><div id="aBiasThresholdHint" class="hint flow-note">${actionBiasThresholdHtml(biasInfo)}</div>${formAction?actionRerunEvidenceHtml(formAction,formRerun,state.tests.find(x=>x.id===formAction.testId)):''}<div class="action-release-block"><div class="action-release-title"><b>Cho phép hoạt động/trả kết quả trở lại</b><small>${form.containmentStatus==='held'?'Bắt buộc sau khi QC được chấp nhận và hành động đã hoàn thành':'Không bắt buộc vì mục 1 không ghi nhận kết quả liên quan bị giữ'}</small></div><div class="action-release-grid"><div><label>Quyết định</label>${actSel('aReleaseStatus','Quyết định cho phép trở lại',ACT_RELEASE_OPTS,form.releaseStatus)}</div><div><label>Ngày cho phép</label>${dateBox('aReleaseDate',form.releaseDate||'','action-date')}</div><div><label>Người cho phép</label><input id="aReleaseBy" list="aByList" autocomplete="off" placeholder="Chọn hoặc gõ tên" value="${escAttr(form.releaseBy||'')}"></div><div><label>Căn cứ cho phép</label><input id="aReleaseNote" placeholder="VD: QC chạy lại đã được chấp nhận" value="${escAttr(form.releaseNote||'')}">${actionSuggestBox('aReleaseNote',ACT_SUGGEST.releaseNote)}</div></div></div>`,actionSectionChip(miss.cause),openSet)}
     ${actionSection('patient','7','Đánh giá ảnh hưởng bệnh nhân','Ghi rõ phạm vi và cách xử lý nếu có liên quan',`<div id="aPatientRiskRef" class="hint space-after-control">${actionBiasReferenceHtml(biasInfo)}</div><div class="action-patient-grid"><div><label>Kết luận ảnh hưởng</label>${actSel('aPatientImpact','Kết luận ảnh hưởng',ACT_PATIENT_OPTS,form.patientImpact)}</div><div><label>Xử lý mẫu/kết quả liên quan</label><textarea id="aPatientAction" rows="1" placeholder="VD: Rà soát các mẫu từ 08:00–10:00; chạy lại 3 mẫu...">${esc(form.patientAction||'')}</textarea>${actionSuggestBox('aPatientAction',ACT_SUGGEST.patientAction)}</div></div>`,actionSectionChip(miss.patient),openSet)}
     ${actionSection('eff','8','Đánh giá hiệu lực','Làm sau thời gian theo dõi; kết luận “có hiệu lực” cần đánh giá nguy cơ còn lại',`<div class="action-effectiveness-grid"><div><label>Kết luận hiệu lực</label>${actSel('aEffectivenessStatus','Kết luận hiệu lực',ACT_EFF_OPTS,form.effectivenessStatus||'pending')}</div><div class="action-effectiveness-date"><label>Ngày đánh giá</label>${dateBox('aEffectivenessDate',form.effectivenessDate||'','action-date')}</div><div><label>Bằng chứng/nhận xét hiệu lực</label><textarea id="aEffectivenessNote" rows="1" placeholder="VD: Theo dõi 20 lần chạy tiếp theo không tái diễn...">${esc(form.effectivenessNote||'')}</textarea>${actionSuggestBox('aEffectivenessNote',ACT_SUGGEST.effectivenessNote)}</div></div><div class="action-residual-block"><div class="action-release-title"><b>Nguy cơ còn lại sau khắc phục</b><small>Chỉ bắt buộc khi kết luận có hiệu lực; dùng cùng thang điểm và SOP với đánh giá ban đầu</small></div><div class="action-residual-grid"><div><label>Mức độ (S)</label>${actSel('aResidualSeverity','Mức độ còn lại',ACT_SEVERITY_OPTS,form.residualSeverity,'onchange="syncActionResidualRiskScore()"')}</div><div><label>Khả năng xảy ra (O)</label>${actSel('aResidualOccurrence','Khả năng xảy ra còn lại',ACT_OCCURRENCE_OPTS,form.residualOccurrence,'onchange="syncActionResidualRiskScore()"')}</div><div><label>Khả năng không phát hiện (D)</label>${actSel('aResidualDetectability','Khả năng không phát hiện còn lại',ACT_DETECT_OPTS,form.residualDetectability,'onchange="syncActionResidualRiskScore()"')}</div><div><label>Phân loại theo SOP</label>${actSel('aResidualRiskLevel','Phân loại nguy cơ còn lại',ACT_RISK_LEVEL_OPTS,form.residualRiskLevel,'onchange="syncActionResidualRiskScore()"')}</div><div class="action-risk-result"><label>RPN còn lại</label><div id="aResidualRiskScoreCard" class="action-risk-score risk-${escAttr(['low','medium','high','critical'].includes(form.residualRiskLevel)?form.residualRiskLevel:'none')}" aria-live="polite"><b id="aResidualRiskScore">${actionResidualRiskScore(form)||'—'}</b></div></div><div class="action-residual-basis"><label>Căn cứ đánh giá lại</label><input id="aResidualRiskBasis" placeholder="VD: SOP-QC-07; dữ liệu theo dõi sau khắc phục" value="${escAttr(form.residualRiskBasis||'')}">${actionSuggestBox('aResidualRiskBasis',ACT_SUGGEST.residualRiskBasis)}</div></div></div>`,actionEffSectionChip(form),openSet)}
     <div class="action-form-submit"><div><b>${editing?'Cập nhật tiến độ hồ sơ':'Lưu ngay ở trạng thái đang điều tra'}</b><span>Chỉ cần hoàn tất phần nhận diện và kiểm soát tức thời để lưu; phê duyệt chỉ xuất hiện khi hồ sơ đủ điều kiện khép vòng.</span></div><div class="action-submit-buttons">${btn(editing?'Hủy chỉnh sửa':'Đóng','closeActionForm()','ghost')}${btn(editing?'Lưu thay đổi':'Lập hồ sơ NCE','addAction()','teal')}</div></div></div>`}</div>`;
}
