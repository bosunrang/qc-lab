/* ===== ACTIONS & REPORT PAGE ROUTES ===== */
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
function actionLevelLabel(l){
  if(!l)return 'Mức ?';
  const lot=l.lot?` · Lô ${l.lot}`:' · Chưa có lô';
  const range=` · Mean ${fmt(l.mean)} · SD ${fmt(l.sd,3)}`;
  const band=l.applied?` · ${l.applied==='lab'?'PXN':'NSX'}`:'';
  return `Mức ${l.level}${lot}${range}${band}`;
}
/* Hồ sơ nguồn ngoài IQC không có mức/lô — không được hiện "M0 · Lô ?" ở nhật ký,
   báo cáo và phiếu chi tiết. */
function actionLevelShort(t,level,lotSnap){
  const n=parseInt(level);
  if(!Number.isFinite(n)||n<=0)return'Không gắn mức QC';
  const l=t&&lvlCfg(t,n),lot=lotSnap||(l&&l.lot)||'?';
  return `M${n} · Lô ${lot}`;
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
  if(labelEl)labelEl.value=l?actionLevelLabel(l):'';
}
/* Ngữ cảnh hiển thị khi sửa: ưu tiên số lô ĐÃ GHI trong hồ sơ, không lấy lô hiện hành
   của mức (lô có thể đã chuyển tiếp từ lúc xảy ra sự cố). */
function actionLevelContext(testId,level,lot){
  const t=state.tests.find(x=>x.id===testId),l=t&&lvlCfg(t,+level);
  if(lot)return `Mức ${level} · Lô ${lot} (đã ghi nhận)`;
  return l?actionLevelLabel(l):`Mức ${level||'?'} · Chưa có lô`;
}
function currentIssues(){
  const out=[],rank={rej:2,warn:1,ok:0};
  operationalTests().forEach(t=>{const wg=activeWestgard(t);wg.views.forEach(v=>{const l=v.l;(v.pts||[]).forEach(p=>{const f=wg.byPoint.get(p.id);if(!f||f.level==='ok'||(typeof pointWorkflowComplete==='function'&&pointWorkflowComplete(p.id)))return;out.push({t,l,p,f,rules:f.rules});});});});
  return out.sort((a,b)=>(rank[b.f.level]||0)-(rank[a.f.level]||0)||String(b.p.date||'').localeCompare(String(a.p.date||'')));
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
  bits.push(`${vnDate(p.date)} · ${fmt(p.val)} ${t&&t.unit||''} · ${form.rule||'—'}`);
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
  return{protocolVersion:version,eventSource:actionFieldValue('aEventSource',40),processPhase:actionFieldValue('aProcessPhase',40),correction:actionFieldValue('aCorrection'),dueDate:parseVN(actionFieldValue('aDueDate',40))||'',riskSeverity:+actionFieldValue('aRiskSeverity',4)||0,riskOccurrence:+actionFieldValue('aRiskOccurrence',4)||0,riskDetectability:+actionFieldValue('aRiskDetectability',4)||0,riskLevel:actionFieldValue('aRiskLevel',40),riskBasis:actionFieldValue('aRiskBasis'),containmentStatus:actionFieldValue('aContainment',40),containmentNote:actionFieldValue('aContainmentNote'),qcMaterialStatus:actionFieldValue('aQcMaterial',40),qcMaterialNote:actionFieldValue('aQcMaterialNote'),instrumentStatus:actionFieldValue('aInstrument',40),instrumentNote:actionFieldValue('aInstrumentNote'),reagentStatus:actionFieldValue('aReagent',40),reagentNote:actionFieldValue('aReagentNote'),calibrationStatus:actionFieldValue('aCalibration',40),calibrationNote:actionFieldValue('aCalibrationNote'),lotToLotStatus:actionFieldValue('aLotToLot',40),lotToLotNote:actionFieldValue('aLotToLotNote'),causeCategory:actionFieldValue('aCauseCategory',40),cause:actionFieldValue('aCause'),actionCompletedDate:parseVN(actionFieldValue('aActionCompletedDate',40))||'',releaseStatus:actionFieldValue('aReleaseStatus',40),releaseDate:parseVN(actionFieldValue('aReleaseDate',40))||'',releaseBy:actionFieldValue('aReleaseBy',120),releaseNote:actionFieldValue('aReleaseNote'),patientImpact:actionFieldValue('aPatientImpact',40),patientAction:actionFieldValue('aPatientAction'),effectivenessStatus:actionFieldValue('aEffectivenessStatus',40)||'pending',effectivenessDate:parseVN(actionFieldValue('aEffectivenessDate',40))||'',effectivenessNote:actionFieldValue('aEffectivenessNote'),residualSeverity:+actionFieldValue('aResidualSeverity',4)||0,residualOccurrence:+actionFieldValue('aResidualOccurrence',4)||0,residualDetectability:+actionFieldValue('aResidualDetectability',4)||0,residualRiskLevel:actionFieldValue('aResidualRiskLevel',40),residualRiskBasis:actionFieldValue('aResidualRiskBasis')};
}
function actionEffectivenessMissingKey(a){
  if(+a.protocolVersion>=3&&!a.actionCompletedDate)return'actionCompletedDate';
  if(!a.effectivenessDate)return'effectivenessDate';
  if(String(a.effectivenessNote||'').trim().length<5)return'effectivenessNote';
  const rerun=actionNeedsRerun(a)?actionRerunStatus(a):null,earliest=[a.date,a.actionCompletedDate,a.releaseDate,rerun&&rerun.ok&&rerun.point&&rerun.point.date].filter(Boolean).sort().pop();
  if(a.effectivenessDate>isoToday()||(earliest&&a.effectivenessDate<earliest))return'effectivenessDate';
  if(a.effectivenessStatus==='effective'&&+a.protocolVersion>=3){
    if(![1,2,3,4,5].includes(+a.residualSeverity))return'residualSeverity';
    if(![1,2,3,4,5].includes(+a.residualOccurrence))return'residualOccurrence';
    if(![1,2,3,4,5].includes(+a.residualDetectability))return'residualDetectability';
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
  const now=new Date().toISOString();
  if(editing){
    if(actionCancelled(editing)){await infoDialog('Hồ sơ đã hủy được giữ nguyên để bảo toàn dấu vết và không thể chỉnh sửa. Hãy lập hồ sơ NCE mới nếu sự cố vẫn cần xử lý.');return;}
    if(actionApprovalStatus(editing)==='approved'){await infoDialog('Hồ sơ đã khép vòng không được sửa. Nếu phát hiện vấn đề tái diễn, hãy mở một hồ sơ NCE mới.');return;}
    /* Người đánh giá hiệu lực chỉ được đóng dấu lại khi chính kết luận hiệu lực thay
       đổi — trước đây mỗi lần lưu bất kỳ đều ghi đè bằng người đang sửa, xoá mất ai là
       người thật sự đã đánh giá. */
    const effChanged=['effectivenessStatus','effectivenessNote','effectivenessDate','residualSeverity','residualOccurrence','residualDetectability','residualRiskLevel','residualRiskBasis'].some(key=>String(protocol[key]??'')!==String(editing[key]??(key==='effectivenessStatus'?'pending':'')));
    const effBy=protocol.effectivenessStatus==='pending'?'':(effChanged?userName():(editing.effectivenessBy||userName()));
    const effAt=protocol.effectivenessStatus==='pending'?'':(effChanged?now:(editing.effectivenessAt||now));
    /* approvalNote bị xoá để vòng duyệt sau bắt đầu sạch, nhưng lý do TRẢ LẠI phải ở
       lại trong hồ sơ (returnNote/By/At) — nếu không, người duyệt yêu cầu bổ sung gì
       sẽ biến mất khỏi hồ sơ ngay khi người thực hiện nộp lại. */
    const editorIds=[...new Set([...(editing.contentEditorUserIds||[]),currentUser&&currentUser.id||''].filter(Boolean))],editorNames=[...new Set([...(editing.contentEditorUsernames||[]),String(currentUser&&currentUser.username||'').trim().toLowerCase()].filter(Boolean))];
    Object.assign(editing,{nceId:editing.nceId||nceId,date,rule,errorType,action,by,...protocol,updatedAt:now,contentEditorUserIds:editorIds,contentEditorUsernames:editorNames,approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:'',effectivenessBy:effBy,effectivenessAt:effAt});
    logAct('Cập nhật hồ sơ NCE',`${editing.nceId||'NCE'} · ${actionWorkflowStatus(editing).label}`,t?t.name:'');actionEditId='';
  }else{
    const record={id:uid(),nceId,date,createdAt:now,updatedAt:now,createdByUserId:currentUser&&currentUser.id||'',createdByUsername:currentUser&&currentUser.username||'',contentEditorUserIds:[currentUser&&currentUser.id||''].filter(Boolean),contentEditorUsernames:[String(currentUser&&currentUser.username||'').trim().toLowerCase()].filter(Boolean),testId:tid,level,lot,pointId,rule,errorType,action,by,...protocol,effectivenessBy:protocol.effectivenessStatus!=='pending'?userName():'',effectivenessAt:protocol.effectivenessStatus!=='pending'?now:'',approvalStatus:'pending',recordStatus:'active',approvedAt:'',approvedBy:'',approvalNote:''};
    state.actions.push(record);logAct('Lập hồ sơ NCE',`${record.nceId} · ${actionLevelShort(t,level,lot)} · đang điều tra`,t?t.name:'');
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
async function cancelAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(actionCancelled(a)){await infoDialog('Hồ sơ này đã được hủy và đang được giữ lại trong nhật ký.');return;}
  if(actionApprovalStatus(a)==='approved'){await infoDialog('Không thể hủy hồ sơ đã duyệt. Nếu cần xử lý tiếp, hãy lập hồ sơ NCE mới.');return;}
  if(actionActiveFollowUp(a)){await infoDialog(`Không thể hủy ${a.nceId||'hồ sơ này'} khi hồ sơ nối tiếp ${a.followUpNceId} vẫn đang hoạt động. Hãy xử lý hoặc hủy hồ sơ nối tiếp trước.`);return;}
  const id=a.id,token=actionApprovalToken(a);
  if(!await reauthenticateCurrentUser({title:'Xác thực hủy hồ sơ NCE',message:'Nhập lại mật khẩu trước khi hủy hồ sơ. Toàn bộ nội dung vẫn được giữ lại trong nhật ký.'}))return;
  const current=(state.actions||[]).find(x=>x.id===id);
  if(!current||actionApprovalToken(current)!==token){await infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi hủy.');return;}
  openModal(modalTemplate({title:'Hủy hồ sơ NCE',body:`
      <div class="alert warn"><b>Hồ sơ sẽ không bị xóa.</b><div>Nội dung, người lập và toàn bộ bằng chứng vẫn được giữ để truy xuất. Nếu hồ sơ gắn với vi phạm QC, sự cố đó sẽ xuất hiện lại để lập hồ sơ mới.</div></div>
      <label>Lý do hủy (tối thiểu 5 ký tự)</label>
      <textarea id="actionCancelReason" placeholder="VD: Mở nhầm cho sai điểm QC; lập lại hồ sơ đúng đối tượng..." oninput="document.getElementById('actionCancelErr').style.display='none'"></textarea>
      <div id="actionCancelErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập lý do hủy tối thiểu 5 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Hủy hồ sơ',`confirmCancelAction('${jsq(current.id)}','${jsq(token)}')`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('actionCancelReason');if(e)e.focus();},50);
}
function confirmCancelAction(id,token){
  const a=(state.actions||[]).find(x=>x.id===id);if(!a){closeModal();return;}
  if(role()!=='admin'){closeModal();infoDialog('Chỉ quản trị viên mới được hủy hồ sơ NCE.');return;}
  if(actionApprovalToken(a)!==token){closeModal();infoDialog('Hồ sơ đã thay đổi. Vui lòng mở lại và kiểm tra trước khi hủy.');return;}
  if(actionCancelled(a)){closeModal();rerender();return;}
  if(actionApprovalStatus(a)==='approved'){closeModal();infoDialog('Không thể hủy hồ sơ đã duyệt.');return;}
  if(actionActiveFollowUp(a)){closeModal();infoDialog('Không thể hủy vì hồ sơ này vừa phát sinh một hồ sơ nối tiếp đang hoạt động.');return;}
  const input=document.getElementById('actionCancelReason'),reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<5){const err=document.getElementById('actionCancelErr');if(err)err.style.display='';return;}
  closeModal();
  const at=new Date().toISOString();
  a.recordStatus='cancelled';a.cancelReason=reason;a.cancelledAt=at;a.cancelledBy=userName();a.updatedAt=at;
  logAct('Hủy hồ sơ NCE',`${a.nceId||a.id||'NCE'} · ${reason}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');
  if(actionEditId===a.id){actionEditId='';actionSeed=null;clearActionDraft();actionOpenSections=null;}
  save({clearDerived:false});rerender();
}
function actionApprovalTag(a){const s=actionApprovalStatus(a),cls=actionCancelled(a)?'none':s==='approved'?'ok':s==='returned'?'rej':'warn';return `<span class="tag ${cls}">${actionApprovalLabel(a)}</span>`;}
function actionApprovalToken(a){const rr=actionRerunStatus(a);return[a&&a.id||'',a&&a.updatedAt||a&&a.createdAt||'',actionWorkflowStatus(a).stage,rr.point&&rr.point.id||'',actionApprovalStatus(a),actionRecordStatus(a)].join('|');}
async function approveAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(actionCancelled(a)){await infoDialog('Hồ sơ đã hủy không thể được duyệt.');return;}
  const approvalId=a.id,preAuthToken=actionApprovalToken(a);
  if(!actionRecorded(a)){await infoDialog('Chưa có hành động khắc phục thực tế để duyệt. Hãy ghi hành động trước.');return;}
  const protocol=actionProtocolStatus(a);if(!protocol.complete){await infoDialog('Chưa thể duyệt vì phiếu điều tra còn thiếu: '+protocol.missing.join(', ')+'.');return;}
  const rerun=actionRerunStatus(a);if(rerun.needed&&!rerun.ok){await infoDialog('Chưa thể duyệt vì chưa có kết quả QC chạy lại được chấp nhận.');return;}
  const effectiveness=actionEffectivenessStatus(a);if(!effectiveness.complete){await infoDialog('Chưa thể duyệt vì hành động chưa được đánh giá là có hiệu lực.');return;}
  if(!actionCanApprove(a,currentUser)){await infoDialog('Người ghi nhận hành động không được tự duyệt chính hành động đó. Hãy đăng nhập bằng tài khoản quản trị độc lập.');return;}
  if(!await reauthenticateCurrentUser({title:'Xác thực người duyệt',message:'Nhập lại mật khẩu trước khi duyệt hành động khắc phục.'}))return;
  const current=(state.actions||[]).find(x=>x.id===approvalId);if(!current||actionApprovalToken(current)!==preAuthToken){await infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi duyệt.');return;}
  const token=actionApprovalToken(current);
  openModal(modalTemplate({title:'Duyệt hành động khắc phục',body:`
      <label>Ý kiến duyệt (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Nhận xét về hành động khắc phục..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập ý kiến duyệt tối thiểu 3 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Duyệt',`confirmApproveAction('${jsq(current.id)}','${jsq(token)}')`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmApproveAction(id,token){
  const a=(state.actions||[]).find(x=>x.id===id);if(!a){closeModal();return;}
  if(role()!=='admin'){closeModal();infoDialog('Chỉ quản trị viên mới được duyệt hồ sơ.');return;}
  if(actionCancelled(a)){closeModal();infoDialog('Hồ sơ đã hủy không thể được duyệt.');return;}
  if(actionApprovalToken(a)!==token){closeModal();infoDialog('Hồ sơ hoặc bằng chứng QC đã thay đổi. Vui lòng mở lại và kiểm tra trước khi duyệt.');return;}
  if(!actionRecorded(a)){closeModal();infoDialog('Chưa có hành động khắc phục thực tế để duyệt.');return;}
  const protocol=actionProtocolStatus(a),rerun=actionRerunStatus(a),effectiveness=actionEffectivenessStatus(a);
  if(!protocol.complete){closeModal();infoDialog('Phiếu điều tra không còn đủ điều kiện duyệt: '+protocol.missing.join(', ')+'.');return;}
  if(rerun.needed&&!rerun.ok){closeModal();infoDialog('Kết quả QC chạy lại không còn hợp lệ.');return;}
  if(!effectiveness.complete){closeModal();infoDialog('Đánh giá hiệu lực không còn đủ điều kiện khép vòng.');return;}
  if(actionApprovalStatus(a)!=='pending'){closeModal();infoDialog('Hồ sơ không còn ở trạng thái chờ duyệt.');return;}
  if(!actionCanApprove(a,currentUser)){closeModal();infoDialog('Không thể duyệt hồ sơ do tài khoản này đã tham gia tạo hoặc chỉnh sửa nội dung.');return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<3){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  a.approvalStatus='approved';a.approvedAt=new Date().toISOString();a.approvedBy=userName();a.approvalNote=note;
  logAct('Duyệt khắc phục',`${a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
async function returnAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(actionCancelled(a)){await infoDialog('Hồ sơ đã hủy không thể trả lại để chỉnh sửa.');return;}
  if(actionWorkflowStatus(a).stage!=='approval'){await infoDialog('Chỉ trả lại được hồ sơ đang ở bước chờ duyệt.');return;}
  const returnId=a.id,preAuthToken=actionApprovalToken(a);
  if(!await reauthenticateCurrentUser({title:'Xác thực người trả lại',message:'Nhập lại mật khẩu trước khi trả lại hành động khắc phục.'}))return;
  const current=(state.actions||[]).find(x=>x.id===returnId);
  if(!current||actionApprovalToken(current)!==preAuthToken||actionWorkflowStatus(current).stage!=='approval'){await infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi trả lại.');return;}
  const token=actionApprovalToken(current);
  openModal(modalTemplate({title:'Trả lại hành động khắc phục',body:`
      <label>Lý do trả lại (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Vì sao trả lại hành động khắc phục này..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập lý do tối thiểu 3 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Trả lại',`confirmReturnAction('${jsq(current.id)}','${jsq(token)}')`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmReturnAction(id,token){
  const a=(state.actions||[]).find(x=>x.id===id);if(!a){closeModal();return;}
  if(role()!=='admin'){closeModal();infoDialog('Chỉ quản trị viên mới được trả lại hồ sơ.');return;}
  if(actionApprovalToken(a)!==token){closeModal();infoDialog('Hồ sơ hoặc bằng chứng QC đã thay đổi. Vui lòng mở lại và kiểm tra trước khi trả lại.');return;}
  if(actionCancelled(a)){closeModal();infoDialog('Hồ sơ đã hủy không thể trả lại để chỉnh sửa.');return;}
  if(actionApprovalStatus(a)!=='pending'||actionWorkflowStatus(a).stage!=='approval'){closeModal();infoDialog('Hồ sơ không còn ở trạng thái chờ duyệt.');return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<3){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  const at=new Date().toISOString();
  a.approvalStatus='returned';a.approvedAt=at;a.approvedBy=userName();a.approvalNote=note;
  a.returnNote=note;a.returnBy=userName();a.returnAt=at;
  logAct('Trả lại khắc phục',`${a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
/* Hành động khắc phục không hiệu lực thì phải mở vòng điều tra mới chứ không treo hồ sơ
   cũ mãi. Hồ sơ mới thừa hưởng danh tính sự cố (xét nghiệm/mức/lô/điểm QC) và trỏ ngược
   về hồ sơ cũ qua parentNceId; hồ sơ cũ ghi followUpNceId để actionEffectivenessStatus()
   cho phép khép lại với kết luận "chưa hiệu lực — đã chuyển". */
function actionCanEscalate(a){return !!(a&&!actionCancelled(a)&&+a.protocolVersion>=2&&a.effectivenessStatus==='ineffective'&&!actionActiveFollowUp(a)&&actionApprovalStatus(a)!=='approved');}
async function escalateAction(i){
  if(!requireWrite())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(!actionCanEscalate(a)){await infoDialog('Chỉ mở hồ sơ tiếp theo cho hồ sơ đã kết luận "chưa hiệu lực" và chưa từng chuyển.');return;}
  const t=state.tests.find(x=>x.id===a.testId),parent=a.nceId||'hồ sơ trước';
  if(!await confirmDialog({kicker:'Vòng điều tra mới',title:'Lập hồ sơ NCE tiếp theo?',message:`Hành động của ${parent} được kết luận chưa hiệu lực. Mở một hồ sơ mới để điều tra lại cùng sự cố này?`,detail:'Hồ sơ cũ sẽ được khép lại với kết luận "chưa hiệu lực — đã chuyển", giữ nguyên toàn bộ nội dung điều tra.',confirmLabel:'Lập hồ sơ tiếp theo',cancelLabel:'Hủy'}))return;
  const now=new Date().toISOString(),nceId=nextNceId(isoToday());
  const record={id:uid(),nceId,parentNceId:a.nceId||'',date:isoToday(),createdAt:now,updatedAt:now,createdByUserId:currentUser&&currentUser.id||'',createdByUsername:currentUser&&currentUser.username||'',contentEditorUserIds:[currentUser&&currentUser.id||''].filter(Boolean),contentEditorUsernames:[String(currentUser&&currentUser.username||'').trim().toLowerCase()].filter(Boolean),
    testId:a.testId,level:a.level,lot:a.lot||'',pointId:a.pointId||'',rule:a.rule||'',errorType:a.errorType||'',qcVerdict:a.qcVerdict||'',
    protocolVersion:3,eventSource:a.eventSource||'iqc',processPhase:a.processPhase||'exam',containmentStatus:a.containmentStatus||'',containmentNote:a.containmentNote||'',
    correction:`Hành động của ${parent} được đánh giá chưa hiệu lực, mở vòng điều tra mới.`,by:userName(),dueDate:nceDueDate(7),
    effectivenessStatus:'pending',approvalStatus:'pending',recordStatus:'active',approvedAt:'',approvedBy:'',approvalNote:''};
  a.followUpNceId=nceId;
  state.actions.push(record);
  logAct('Lập hồ sơ NCE tiếp theo',`${nceId} · nối tiếp ${parent} (hành động chưa hiệu lực)`,t?t.name:'Khắc phục');
  save({clearDerived:false});actionEditId=record.id;actionSeed=null;clearActionDraft();rerender();
  const panel=document.querySelector('.action-form-panel');if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});
}
/* Lối thoát cho hồ sơ kẹt: actionRerunStatus() tính động, nên một hồ sơ ĐÃ DUYỆT có thể
   tụt lại khỏi trạng thái khép vòng (ví dụ chính điểm QC dùng làm bằng chứng chạy lại
   sau đó bị hủy). Lúc đó sửa bị chặn vì đã duyệt, xóa bị chặn vì đã duyệt, nút Duyệt
   không hiện vì stage!=='approval' — không còn đường nào. Chỉ mở lại đúng trường hợp
   này, hồ sơ khép vòng hợp lệ vẫn bất biến theo quy ước cũ. */
function actionCanReopen(a){return !actionCancelled(a)&&actionApprovalStatus(a)==='approved'&&!actionWorkflowStatus(a).complete;}
async function reopenAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(!actionCanReopen(a)){await infoDialog('Chỉ mở lại được hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng. Hồ sơ đã khép vòng hợp lệ thì mở hồ sơ NCE mới.');return;}
  if(!await reauthenticateCurrentUser({title:'Xác thực mở lại hồ sơ',message:'Nhập lại mật khẩu trước khi mở lại hồ sơ đã duyệt.'}))return;
  openModal(modalTemplate({title:'Mở lại hồ sơ đã duyệt',body:`
      <div class="alert warn">Hồ sơ đã duyệt nhưng điều kiện khép vòng không còn đúng: ${esc(actionWorkflowStatus(a).label)}.</div>
      <label>Lý do mở lại (tối thiểu 5 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="VD: Điểm QC dùng làm bằng chứng chạy lại đã bị hủy..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập lý do tối thiểu 5 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Mở lại hồ sơ',`confirmReopenAction(${i})`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmReopenAction(i){
  const a=state.actions&&state.actions[i];if(!a){closeModal();return;}
  if(!actionCanReopen(a)){closeModal();rerender();return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<5){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  a.approvalStatus='pending';a.approvedAt='';a.approvedBy='';a.approvalNote=`Mở lại: ${note}`;
  logAct('Mở lại hồ sơ NCE',`${a.nceId||a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
function actionReviewButtons(i,a){
  const s=actionApprovalStatus(a),wf=actionWorkflowStatus(a),cancelled=actionCancelled(a),edit=!cancelled&&s!=='approved'&&canWrite()?btn('Tiếp tục',`editAction(${i})`,'ghost sm'):'';
  const escalate=actionCanEscalate(a)&&canWrite()?btn('Lập hồ sơ tiếp theo',`escalateAction(${i})`,'teal sm','Hành động chưa hiệu lực — mở vòng điều tra mới'):'';
  if(role()!=='admin')return `<div class="action-row-actions">${btn('Chi tiết',`viewActionDetail(${i})`,'ghost sm')}${edit}${escalate}</div>`;
  return `<div class="action-row-actions">${btn('Chi tiết',`viewActionDetail(${i})`,'ghost sm')}${edit}${escalate}${wf.stage==='approval'?btn('Duyệt',`approveAction(${i})`,'teal sm'):''}${wf.stage==='approval'?btn('Trả lại',`returnAction(${i})`,'ghost sm'):''}${actionCanReopen(a)?btn('Mở lại',`reopenAction(${i})`,'danger sm','Hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng'):''}${!cancelled&&s!=='approved'?btn('Hủy hồ sơ',`cancelAction(${i})`,'danger sm','Hủy có lưu vết — không xóa dữ liệu'):''}</div>`;
}
/* Chip phụ dùng chung cho dòng vi phạm, dòng NCE đang mở và bảng nhật ký, để ba chỗ
   không lệch nhau (đúng lỗi chip QC chạy lại chỉ hiện ở một chỗ trước đây). */
function actionSideChips(a,stage){
  if(actionCancelled(a))return'';
  const rerun=actionRerunStatus(a),over=actionOverdue(a),eff=actionEffectivenessStatus(a);
  return (rerun.needed&&stage!=='rerun'?`<span class="action-chip ${rerun.cls}">${esc(rerun.label)}</span>`:'')
    +(over.overdue?`<span class="action-chip rej">${esc(over.label)}</span>`:'')
    +(eff.escalated?`<span class="action-chip warn">${esc('Đã chuyển '+a.followUpNceId)}</span>`:'')
    +(a.parentNceId?`<span class="action-chip none">${esc('Nối tiếp '+a.parentNceId)}</span>`:'');
}
function actionDetailCheck(label,status,note){
  const cls=['abnormal','checked-abnormal'].includes(status)?'rej':['ok','checked-ok'].includes(status)?'ok':'none';
  return `<div class="action-detail-check"><div><b>${esc(label)}</b>${note?`<div class="hint">${esc(note)}</div>`:''}</div><span class="tag ${cls}">${esc(ACTION_LABELS.check[status]||'Chưa ghi')}</span></div>`;
}
function actionEvidenceTime(value,dateOnly=false){
  if(!value)return'—';
  return dateOnly?vnDate(value):(formatDateTimeVN(value)||vnDate(value));
}
function actionEvidenceTimelineHtml(a,rr){
  const p=actionPoint(a),rerun=rr&&rr.point,eventDate=actionEventDate(a),voidText=!p?'Không áp dụng':p.voided?(p.voidedAt?actionEvidenceTime(p.voidedAt):'Đã hủy · thiếu thời điểm'):'Chưa hủy',openedText=a.createdAt?actionEvidenceTime(a.createdAt):actionEvidenceTime(a.date,true);
  const items=[
    ['Ngày xảy ra',actionEvidenceTime(eventDate,true),p&&p.runId?`Lần ${p.runId}`:''],
    ['QC chạy lại',!p?'Không áp dụng':rerun?actionEvidenceTime(rerun.date,true):'—',!p?'Nguồn ngoài IQC':rerun&&rerun.runId?`Lần ${rerun.runId}`:'Chưa có điểm phù hợp'],
    ['Hủy điểm',voidText,p&&p.voidedBy?`Bởi ${p.voidedBy}`:''],
    ['Mở hồ sơ',openedText,a.nceId||'NCE']
  ];
  return `<div class="action-evidence-timeline" aria-label="Các mốc thời gian hồ sơ">${items.map(([label,value,note])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b>${note?`<small>${esc(note)}</small>`:''}</div>`).join('')}</div>`;
}
function actionRerunEvidenceHtml(a,rr,t){
  const p=actionPoint(a);if(!p||!rr||!rr.needed)return'';
  if(!rr.point)return `<div class="action-rerun-evidence warn"><div class="action-rerun-mark" aria-hidden="true">QC</div><div class="action-rerun-copy"><small>Bằng chứng QC chạy lại</small><b>Chưa có kết quả phù hợp</b><span>${esc(rr.label||'Đang chờ QC chạy lại được chấp nhận')}</span></div></div>`;
  const q=rr.point,context=t?actionLevelShort(t,q.level,q.lot):`Mức ${q.level} · Lô ${q.lot||'—'}`,viewBtn=btn('Xem điểm QC',`openActionQcEvidence('${jsq(a.testId)}',${+q.level||0},'${jsq(q.id)}','${jsq(q.date||'')}','${jsq(q.lot||'')}')`,'ghost sm','Mở đúng điểm QC được dùng làm bằng chứng');
  return `<div class="action-rerun-evidence ${rr.cls==='warn'?'warn':'ok'}"><div class="action-rerun-mark" aria-hidden="true">QC</div><div class="action-rerun-copy"><small>Bằng chứng QC chạy lại</small><b>${rr.cls==='warn'?'QC được chấp nhận kèm cảnh báo':'QC chạy lại được chấp nhận'}</b><span>${fmt(q.val)} ${esc(t&&t.unit||'')} · ${vnDate(q.date)} · ${esc(q.runId||'Không có mã lần chạy')}</span><span>${esc(context)}</span></div><div class="action-rerun-actions">${viewBtn}</div></div>`;
}
function openActionQcEvidence(tid,level,pointId,date,lot){
  if(typeof captureActionDraft==='function'&&page==='actions')captureActionDraft();
  closeModal();entrySel={testId:tid,level:+level};entryStart=date||null;entryEnd=date||null;entryLastMsg=`<div class="alert ok">Đang hiển thị điểm QC được dùng làm bằng chứng ngày ${esc(vnDate(date))}.</div>`;
  const t=state.tests.find(x=>x.id===tid),l=t&&lvlCfg(t,+level);
  if(l&&lot&&String(lot)!==String(l.lot||''))entryPrevOpen.set(tid+'|'+level,lot);
  go('entry');
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const row=[...document.querySelectorAll('[data-qc-point-id]')].find(x=>x.dataset.qcPointId===String(pointId));
    if(!row)return;
    row.classList.add('qc-point-evidence-focus');row.scrollIntoView({behavior:'smooth',block:'center'});row.focus({preventScroll:true});
  }));
}
function viewActionDetail(i){
  const a=state.actions&&state.actions[i],t=a&&state.tests.find(x=>x.id===a.testId);if(!a)return;
  const legacy=!a.protocolVersion,modern=a.protocolVersion>=2,rr=actionRerunStatus(a),wf=actionWorkflowStatus(a),eff=actionEffectivenessStatus(a),residual=actionResidualRiskScore(a),sourceLabels=ACTION_LABELS.source,phaseLabels=ACTION_LABELS.phase,riskLabels=ACTION_LABELS.risk;
  const verdict=actionQcVerdictLabel(a),violation=actionViolationInfo(a),meta=`<div class="action-detail-meta"><div><span>${modern?esc(a.nceId||'Mã NCE'):'Sự cố'}</span><b>${t?esc(testDisplayName(t)):'—'} · ${esc(actionLevelShort(t,a.level,a.lot))}</b></div><div><span>Kết luận / luật / loại sai số</span><b>${verdict?esc(verdict)+' · ':''}${esc(violation.rule)} · ${esc(violation.errorType)}</b></div>${modern?`<div><span>Nguồn / giai đoạn</span><b>${esc(sourceLabels[a.eventSource]||'—')} · ${esc(phaseLabels[a.processPhase]||'—')}</b></div><div><span>Nguy cơ</span><b>${esc(riskLabels[a.riskLevel]||'Chưa đánh giá')} · RPN ${actionRiskScore(a)||'—'}</b>${a.riskBasis?`<small>${esc(a.riskBasis)}</small>`:''}</div><div><span>Phụ trách / hạn xử lý</span><b>${esc(a.by||'—')} · ${a.dueDate?vnDate(a.dueDate):'—'}${actionOverdue(a).overdue?' · '+esc(actionOverdue(a).label):''}</b></div><div><span>Trạng thái</span><b>${esc(wf.label)}</b></div>`:''}</div>`;
  const cancelledAlert=actionCancelled(a)?`<div class="alert warn"><b>Hồ sơ đã hủy — dữ liệu được giữ để truy xuất.</b><div>${esc(a.cancelReason||'Không có lý do')}${a.cancelledBy?' · '+esc(a.cancelledBy):''}${a.cancelledAt?' · '+formatDateTimeVN(a.cancelledAt):''}</div></div>`:'';
  const body=legacy?`${cancelledAlert}<div class="alert warn">Bản ghi được tạo trước khi có phiếu điều tra 8 bước. Dữ liệu hành động cũ vẫn được giữ nguyên.</div>${meta}<div class="action-detail-legacy"><b>Hành động đã ghi</b><div>${esc(a.action||'—')}</div><div class="hint">${esc(a.by||'—')} · ${esc(rr.label||'Chưa có dữ liệu')} · ${esc(actionApprovalLabel(a))}</div></div>`:`
    ${cancelledAlert}${meta}${actionEvidenceTimelineHtml(a,rr)}${actionRerunEvidenceHtml(a,rr,t)}
    <ol class="action-detail-steps">
      <li><b>Kiểm soát tức thời</b><div>${esc(ACTION_LABELS.containment[a.containmentStatus]||'Chưa ghi')}</div>${modern?`<div>${esc(a.correction||'Chưa ghi xử lý tức thời')}</div>`:''}${a.containmentNote?`<div class="hint">${esc(a.containmentNote)}</div>`:''}</li>
      <li><b>Kiểm tra vật liệu QC</b>${actionDetailCheck('Hạn dùng, bảo quản, hoàn nguyên và chuẩn bị',a.qcMaterialStatus,a.qcMaterialNote)}</li>
      <li><b>Kiểm tra máy phân tích</b>${actionDetailCheck('Điện, nước, nhiệt độ, cảnh báo và bảo trì',a.instrumentStatus,a.instrumentNote)}</li>
      <li><b>Kiểm tra hóa chất / calibrator</b>${actionDetailCheck('Hạn dùng, số lô, bảo quản và lot-to-lot',a.reagentStatus,a.reagentNote)}${actionDetailCheck('So sánh lot-to-lot',a.lotToLotStatus,a.lotToLotNote)}</li>
      <li><b>Kiểm tra hiệu chuẩn</b>${actionDetailCheck('Tình trạng hiệu chuẩn',a.calibrationStatus,a.calibrationNote)}</li>
      <li><b>Nguyên nhân, hành động và QC chạy lại</b><div>${esc(a.cause||'Chưa xác định nguyên nhân')}</div><div>${esc(a.action||'Chưa ghi hành động khắc phục')}</div>${a.actionCompletedDate?`<div class="hint">Hoàn thành hành động: ${vnDate(a.actionCompletedDate)}</div>`:''}${a.protocolVersion>=3&&a.containmentStatus==='held'?`<div><b>${esc(ACTION_LABELS.release[a.releaseStatus]||'Chưa cho phép hoạt động/trả kết quả trở lại')}</b></div>${a.releaseDate||a.releaseBy||a.releaseNote?`<div class="hint">${a.releaseDate?vnDate(a.releaseDate)+' · ':''}${esc(a.releaseBy||'Chưa ghi người cho phép')}${a.releaseNote?' · '+esc(a.releaseNote):''}</div>`:''}`:''}</li>
      <li><b>Đánh giá ảnh hưởng bệnh nhân</b><div>${esc(ACTION_LABELS.patient[a.patientImpact]||'Chưa đánh giá')}</div>${a.patientAction?`<div class="hint">${esc(a.patientAction)}</div>`:''}</li>
      <li><b>Đánh giá hiệu lực, phê duyệt và khép vòng</b><div>${modern?esc(eff.label):esc(a.cause||'—')}</div>${modern&&a.effectivenessNote?`<div class="hint">${a.effectivenessDate?vnDate(a.effectivenessDate)+' · ':''}${esc(a.effectivenessNote)}${a.effectivenessBy?' · '+esc(a.effectivenessBy):''}</div>`:''}${+a.protocolVersion>=3&&residual?`<div>Nguy cơ còn lại: ${esc(ACTION_LABELS.risk[a.residualRiskLevel]||'Chưa phân loại')} · RPN ${residual}</div>${a.residualRiskBasis?`<div class="hint">${esc(a.residualRiskBasis)}</div>`:''}`:''}${a.returnNote?`<div class="hint">Đã trả lại: ${esc(a.returnNote)}${a.returnBy?' — '+esc(a.returnBy):''}${a.returnAt?' · '+formatDateTimeVN(a.returnAt):''}</div>`:''}${a.followUpNceId?`<div class="hint">Đã chuyển sang hồ sơ ${esc(a.followUpNceId)}</div>`:''}${a.parentNceId?`<div class="hint">Nối tiếp hồ sơ ${esc(a.parentNceId)}</div>`:''}<div class="hint">${esc(actionApprovalLabel(a))}${a.approvedBy?' · '+esc(a.approvedBy):''} · ${esc(wf.label)}</div></li>
    </ol>`;
  openModal(modalTemplate({title:'Chi tiết phiếu xử lý sự cố',body,footer:btn('Đóng','closeModal()','teal')}));
}
function openActionGuide(){
  const steps=[
    ['control','Kiểm soát','Ghi nhận và kiểm soát tức thời','Dừng hoặc giữ kết quả liên quan, mở mã NCE và phân công người phụ trách.'],
    ['control','Phân tầng','Đánh giá nguy cơ','Chấm S–O–D, tính RPN và ghi căn cứ phân loại theo SOP của đơn vị.'],
    ['investigate','Điều tra','Điều tra nguyên nhân','Kiểm tra QC, thiết bị, hóa chất/calibrator, hiệu chuẩn và lot-to-lot.'],
    ['investigate','Phân tích','Xác định nguyên nhân gốc','Ghi bằng chứng; không đồng nhất nguyên nhân với thao tác xử lý tức thời.'],
    ['investigate','Khắc phục','Thực hiện hành động khắc phục','Loại bỏ nguyên nhân và giảm khả năng tái diễn.'],
    ['verify','Xác nhận','Xác nhận bằng QC','Chỉ cho phép hoạt động/trả kết quả trở lại sau khi QC chạy lại được chấp nhận.'],
    ['verify','An toàn người bệnh','Đánh giá ảnh hưởng bệnh nhân','Khoanh vùng từ lần QC đạt cuối cùng và xử lý kết quả liên quan.'],
    ['close','Khép vòng','Đánh giá hiệu lực và phê duyệt','Ghi bằng chứng, đánh giá RPN còn lại và phê duyệt độc lập trước khi khép vòng.']
  ];
  const list=steps.map(([stage,phase,title,text],i)=>`<li class="action-guide-card ${stage}"><span class="action-guide-number">${i+1}</span><div><small>${esc(phase)}</small><b>${esc(title)}</b><p>${esc(text)}</p></div></li>`).join('');
  const body=`<div class="modal-b" tabindex="0" aria-label="Nội dung quy trình 8 bước"><div class="action-guide-intro"><div class="action-guide-mark">NCE</div><div><small>Nguyên tắc cốt lõi</small><b>Lưu sớm, hoàn thiện theo tiến độ</b><p>Sau bước 1, lưu hồ sơ ở trạng thái <strong>Đang điều tra</strong>; không chờ hoàn tất toàn bộ quy trình.</p></div></div><div class="action-guide-legend"><span class="control">1–2 · Kiểm soát</span><span class="investigate">3–5 · Điều tra & khắc phục</span><span class="verify">6–8 · Xác nhận & khép vòng</span></div><ol class="action-guide-list">${list}</ol></div>`;
  const footer=`<div class="action-guide-footer-note"><b>Điều kiện khép vòng</b><span>Đủ bằng chứng QC, quyết định cho phép trở lại (nếu đã giữ kết quả), đánh giá nguy cơ còn lại và phê duyệt độc lập</span></div>${btn('Đóng hướng dẫn','closeModal()','teal')}`;
  openModal(modalTemplate({title:'Quy trình 8 bước xử lý hồ sơ NCE',body,footer,cls:'action-guide-modal',bodyClass:''}));
}
function groupIssuesByTestDate(issues){
  const groups=[],byKey=new Map();
  issues.forEach(o=>{
    const key=o.t.id+'|'+o.p.date;
    let g=byKey.get(key);
    if(!g){g={t:o.t,date:o.p.date,items:[],worst:'warn'};byKey.set(key,g);groups.push(g);}
    g.items.push(o);
    if(o.f.level==='rej')g.worst='rej';
  });
  return groups;
}
/* Dòng vi phạm phải hiện luôn tình trạng QC chạy lại và mã hồ sơ, y như dòng ở mục
   "Hồ sơ NCE đang mở": hồ sơ của chính điểm này bị lọc khỏi mục đó để khỏi trùng
   (xem openActions trong pageActionsV4), nên nếu chỉ hiện một chip trạng thái thì
   chạy lại QC xong người dùng không thấy gì đổi ở đây cả. */
function issueRowHtml(o){
  const rules=o.rules.join(', '),err=errorType(o.rules),hint=fixHint(o.rules),wf=pointWorkflowSummary(o.p.id),acts=typeof pointRealActions==='function'?pointRealActions(o.p.id):[],latest=acts[acts.length-1],idx=latest?(state.actions||[]).indexOf(latest):-1;
  const sideChips=latest?actionSideChips(latest,actionWorkflowStatus(latest).stage):'';
  const foot=latest?`${latest.nceId?esc(latest.nceId)+' · ':''}Phụ trách: ${esc(latest.by||'—')}${latest.dueDate?' · hạn '+vnDate(latest.dueDate):''}`:hint;
  return `<div class="issue-row ${o.f.level}"><div class="issue-row-main"><b>${esc(actionLevelShort(o.t,o.l.level,o.l.lot))} · ${stateName(o.f.level)}</b><div class="meta">${fmt(o.p.val)} ${esc(o.t.unit||'')} · ${rules||'—'} · ${err}</div><div class="action-chipline"><span class="action-chip ${wf.cls}">${esc(wf.label)}</span>${sideChips}</div><div class="hint">${foot}</div></div>${canWrite()?(idx>=0?btn('Tiếp tục hồ sơ',`editAction(${idx})`,'ghost sm'):btn('Lập hồ sơ',`beginActionFromIssue('${o.t.id}',${o.l.level},'${jsq(rules)}','${jsq(err)}','${jsq(hint)}','${jsq(o.p.id||'')}','${jsq(o.p.date||'')}')`,'ghost sm')):''}</div>`;
}
/* Hồ sơ cũ tự sinh lúc hủy điểm chỉ lưu rule='Hủy điểm QC' — không phải luật Westgard.
   Suy |Z| của chính điểm đó ra ngữ cảnh đọc được, nhưng LUÔN gắn nhãn "suy từ Z" và
   không bao giờ ghi ngược vào bản ghi: luật thật có thể là 2-2s/R4s/4-1s chứ không chỉ
   luật đơn điểm, và khi thiếu snapshot Mean/SD thì phép suy này dùng Mean/SD hiện hành.
   addAction() vì vậy chỉ lưu giá trị người dùng gõ, còn CSV/Excel/bản in vẫn xuất
   a.rule gốc. */
function actionViolationInfo(a){
  const rule=String(a&&a.rule||''),error=String(a&&a.errorType||''),verdict=String(a&&a.qcVerdict||'');
  if(rule==='Hủy điểm QC'||error==='Quản lý dữ liệu QC'){
    const p=actionPoint(a),t=state.tests.find(x=>x.id===a.testId),l=t&&lvlCfg(t,a.level),mean=Number(p&&p.qcMean)||Number(l&&l.mean),sd=Number(p&&p.qcSd)||Number(l&&l.sd),z=p&&Number.isFinite(mean)&&sd>0?Math.abs((Number(p.val)-mean)/sd):0;
    const guess=z>3?'1-3s':z>2?'1-2s':'';
    return{rule:guess?`${guess} (suy từ Z)`:'Không xác định (hồ sơ cũ)',errorType:errorType(guess?[guess]:[]),verdict:verdict||(z>3?'rej':z>2?'warn':'invalid'),derived:true};
  }
  return{rule:rule||'—',errorType:error||'—',verdict,derived:false};
}
function actionQcVerdictLabel(a){const verdict=actionViolationInfo(a).verdict;return verdict==='rej'?'Loại bỏ':verdict==='warn'?'Cảnh báo':verdict==='invalid'?'QC không hợp lệ':'';}
function openActionIssueHtml(a,idx){
  const t=state.tests.find(x=>x.id===a.testId),wf=actionWorkflowStatus(a),violation=actionViolationInfo(a),title=a.nceId||'Hồ sơ khắc phục',context=t?`${testDisplayName(t)} · ${actionLevelShort(t,a.level,a.lot)}`:(violation.rule||'Sự cố'),primary=a.correction||a.action||'Đang điều tra',verdict=actionQcVerdictLabel(a);
  return `<div class="issue-row ${wf.cls==='rej'?'rej':'warn'}"><div class="issue-row-main"><b>${esc(title)} · ${esc(context)}</b><div class="meta">${vnDate(actionEventDate(a))}${verdict?' · '+esc(verdict):''} · ${esc(violation.rule)} · ${esc(violation.errorType)}</div><div class="action-chipline"><span class="action-chip ${wf.cls}">${esc(wf.label)}</span>${actionSideChips(a,wf.stage)}</div><div class="hint">${esc(primary)} · Phụ trách: ${esc(a.by||'—')}${a.dueDate?' · hạn '+vnDate(a.dueDate):''}</div></div>${canWrite()?btn('Tiếp tục hồ sơ',`editAction(${idx})`,'ghost sm'):''}</div>`;
}
function actionInvestigationField(statusId,noteId,title,hint,form,statusKey,noteKey,lotToLot=false){
  const value=String(form[statusKey]||''),choices=(lotToLot?ACT_LOT2LOT_OPTS:ACT_CHECK_OPTS).filter(([v])=>v),stateCls=actionInvestigationStateClass(value),stateLabel=ACTION_LABELS.check[value]||'Chưa kết luận';
  return `<div class="action-investigation-item ${stateCls}" id="check-${escAttr(statusId)}"><div class="action-investigation-head"><div><b>${esc(title)}</b><small>${esc(hint)}</small></div><span class="action-investigation-state">${esc(stateLabel)}</span></div>
    <select id="${statusId}" class="action-investigation-select" aria-hidden="true" tabindex="-1" onchange="actionInvestigationSync('${jsq(statusId)}')">${(lotToLot?ACT_LOT2LOT_OPTS:ACT_CHECK_OPTS).map(([v,label])=>`<option value="${escAttr(v)}" ${v===value?'selected':''}>${esc(label)}</option>`).join('')}</select>
    <div class="action-investigation-choices" role="group" aria-label="${escAttr('Kết quả '+title)}">${choices.map(([v,label])=>`<button type="button" class="action-choice ${v===value?'active':''}" data-value="${escAttr(v)}" aria-pressed="${v===value?'true':'false'}" onclick="actionInvestigationChoose('${jsq(statusId)}','${jsq(v)}')">${esc(actionInvestigationChoiceLabel(v,label))}</button>`).join('')}</div>
    <div class="action-investigation-note"><input id="${noteId}" aria-label="Ghi chú ${escAttr(title)}" placeholder="Ghi chú / bằng chứng" value="${escAttr(form[noteKey]||'')}">${actionSuggestBox(noteId,ACT_SUGGEST[noteKey],'Gợi ý bằng chứng')}</div></div>`;
}
function actionInvestigationChoiceLabel(value,label){return value==='not-needed'?'Không cần':value==='checked-ok'?'Đạt':value==='checked-abnormal'?'Bất thường':label;}
function actionInvestigationStateClass(value){return['ok','checked-ok'].includes(value)?'is-ok':['abnormal','checked-abnormal'].includes(value)?'is-abnormal':['na','not-needed'].includes(value)?'is-na':'is-empty';}
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
  const done=ACT_CHECK_FIELDS.filter(([statusId,noteId])=>{const status=(document.getElementById(statusId)||{}).value,note=String((document.getElementById(noteId)||{}).value||'').trim(),valid=!!ACTION_LABELS.check[status],needNote=['abnormal','na','checked-abnormal'].includes(status);return valid&&(!needNote||note.length>=3);}).length;
  chip.textContent=`Đã hoàn tất ${done}/${ACT_CHECK_FIELDS.length}`;chip.classList.toggle('ok',done===ACT_CHECK_FIELDS.length);chip.classList.toggle('warn',done!==ACT_CHECK_FIELDS.length);
}
/* Bọc một mục thành <details> thu gọn được. Dùng thẻ gốc thay vì tự dựng bằng JS:
   bàn phím, ARIA và trạng thái mở/đóng do trình duyệt lo, không phát sinh vi phạm
   a11y nào. ontoggle ghi lại trạng thái để rerender() không bung/thu lung tung. */
function actionSectionChip(missing){
  const n=(missing||[]).length;
  return n?{cls:'warn',label:`Còn thiếu ${n} mục`,title:`Còn thiếu: ${missing.join('; ')}`}:{cls:'ok',label:'Đã xong',title:'Không còn mục bắt buộc chưa hoàn thành'};
}
function actionChecklistChip(form){
  const done=ACT_CHECK_FIELDS.filter(([, ,statusKey,noteKey])=>{const status=form[statusKey],valid=!!ACTION_LABELS.check[status],needNote=['abnormal','na','checked-abnormal'].includes(status);return valid&&(!needNote||String(form[noteKey]||'').trim().length>=3);}).length;
  return{cls:done===ACT_CHECK_FIELDS.length?'ok':'warn',label:`Đã hoàn tất ${done}/${ACT_CHECK_FIELDS.length}`};
}
/* Mục 8 không nằm trong checklist khép vòng nên không có số "còn thiếu" — chip lấy
   thẳng từ cổng hiệu lực, nếu không sẽ luôn hiện "Đã xong" cho hồ sơ còn trắng. */
function actionEffSectionChip(form){
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
function pageActionsV4(){
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
  const issues=currentIssues(),activePointIds=new Set(issues.map(o=>o.p.id));
  const issueGroups=groupIssuesByTestDate(issues);
  const violationHtml=issueGroups.map(g=>`<div class="issue-group ${g.worst}"><div class="issue-group-h"><div><b>${esc(testDisplayName(g.t))}</b><span class="issue-group-date">${vnDate(g.date)}</span></div><span class="issue-group-count">${g.items.length} vi phạm</span></div><div class="issue-group-body">${g.items.map(issueRowHtml).join('')}</div></div>`).join('');
  const openActions=(state.actions||[]).map((a,idx)=>({a,idx})).filter(({a})=>!actionCancelled(a)&&actionRecorded(a)&&!actionWorkflowStatus(a).complete&&(!a.pointId||!activePointIds.has(a.pointId)));
  const openActionHtml=openActions.length?`<div class="issue-group warn"><div class="issue-group-h"><div><b>Hồ sơ NCE đang mở</b><span class="issue-group-date">Cần tiếp tục xử lý</span></div><span class="issue-group-count">${openActions.length} hồ sơ</span></div><div class="issue-group-body">${openActions.map(({a,idx})=>openActionIssueHtml(a,idx)).join('')}</div></div>`:'';
  const issueHtml=violationHtml+openActionHtml||'<div class="alert ok">Không có vi phạm/cảnh báo hoặc hồ sơ NCE đang mở.</div>';
  const rows=(state.actions||[]).slice().reverse().map((a,idx)=>{const realIdx=state.actions.length-1-idx,t=state.tests.find(x=>x.id===a.testId),wf=actionWorkflowStatus(a),approval=actionApprovalStatus(a),openedAt=a.createdAt?formatDateTimeVN(a.createdAt):'',primary=a.action||a.correction||'Đang điều tra';
    const approveMeta=approval==='pending'?'':`<div class="action-note">${esc(a.approvedBy||'')} ${a.approvedAt?formatDateTimeVN(a.approvedAt):''}${a.approvalNote?' · '+esc(a.approvalNote):''}</div>`;
    return `<tr>
      <td><div class="action-date">${vnDate(actionEventDate(a))}</div>${openedAt?`<div class="action-time">Mở: ${esc(openedAt)}</div>`:''}</td>
      <td><div class="action-test">${a.nceId?esc(a.nceId)+' · ':''}${t?esc(testDisplayName(t)):esc(a.rule||'Cập nhật')}</div><div class="action-sub">${t?esc(actionLevelShort(t,a.level,a.lot)):esc(a.lot?'Nhóm lô '+a.lot:'—')}</div><div class="action-rule">${t?(actionQcVerdictLabel(a)?esc(actionQcVerdictLabel(a))+' · ':'')+esc(actionViolationInfo(a).rule)+' · '+esc(actionViolationInfo(a).errorType):esc(a.errorType||'—')}</div></td>
      <td><div class="action-text">${esc(primary)}</div><div class="action-sub">Phụ trách: ${esc(a.by||'—')}${a.dueDate?' · hạn '+vnDate(a.dueDate):''}</div></td>
      <td><div class="action-status-stack"><span class="action-chip ${wf.cls}">${esc(wf.label)}</span>${actionSideChips(a,wf.stage)}${!actionCancelled(a)&&approval!=='pending'?actionApprovalTag(a):''}${approveMeta}</div></td>
      <td>${actionReviewButtons(realIdx,a)}</td>
    </tr>`;}).join('');
  return headOnly('Khắc phục sự cố','Điều tra nguyên nhân, ghi nhận, chạy lại QC và phê duyệt khép vòng')+
   `<div class="panel action-issues-panel"><h3 role="heading" aria-level="2">Sự cố cần xử lý</h3><div class="dash-list">${issueHtml}</div></div>`+
   `<div class="panel action-form-panel"><div class="action-form-panel-head"><h3>${editing?'Tiếp tục hồ sơ '+esc(editing.nceId||'NCE'):'Lập hồ sơ sự không phù hợp (NCE)'}</h3>${btn('Quy trình 8 bước','openActionGuide()','ghost sm')}</div>${!formOpen?actionFormClosedHtml(issues.length):`<div class="action-form-body" oninput="actionFormChanged()" onchange="actionFormChanged()">${actionIncidentBanner(form,editing)}<div class="action-form-section"><div class="action-form-section-title"><span>Hồ sơ</span><div><b>Nhận diện sự cố</b><small>Có thể lưu ngay sau khi kiểm soát tức thời; không cần chờ điều tra xong</small></div></div>
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
      ${actionSection('cause','4–6','Nguyên nhân gốc và hành động khắc phục','Tách khỏi xử lý tức thời; QC chạy lại được tự liên kết',`<div class="action-cause-grid"><div><label>Nhóm nguyên nhân</label>${actSel('aCauseCategory','Nhóm nguyên nhân',ACT_CAUSE_OPTS,form.causeCategory,'onchange="syncActionSuggestions()"')}</div><div><label>Nguyên nhân gốc hoặc nghi ngờ</label><textarea id="aCause" rows="1" placeholder="Mô tả bằng chứng và nguyên nhân...">${esc(form.cause||'')}</textarea>${actionSuggestBox('aCause',actionCausePhrases(form.causeCategory))}</div><div><label>Hành động khắc phục để ngăn tái diễn</label><textarea id="aAct" rows="1" placeholder="VD: Thay lọ QC mới, vệ sinh kim hút, cập nhật lịch bảo trì...">${esc(form.action||'')}</textarea>${actionSuggestBox('aAct',actionActionPhrases(form.errorType))}</div><div class="action-cause-date"><label>Ngày hoàn thành hành động</label>${dateBox('aActionCompletedDate',form.actionCompletedDate||'','action-date')}</div></div>${formAction?actionRerunEvidenceHtml(formAction,formRerun,state.tests.find(x=>x.id===formAction.testId)):''}<div class="action-release-block"><div class="action-release-title"><b>Cho phép hoạt động/trả kết quả trở lại</b><small>${form.containmentStatus==='held'?'Bắt buộc sau khi QC được chấp nhận và hành động đã hoàn thành':'Không bắt buộc vì mục 1 không ghi nhận kết quả liên quan bị giữ'}</small></div><div class="action-release-grid"><div><label>Quyết định</label>${actSel('aReleaseStatus','Quyết định cho phép trở lại',ACT_RELEASE_OPTS,form.releaseStatus)}</div><div><label>Ngày cho phép</label>${dateBox('aReleaseDate',form.releaseDate||'','action-date')}</div><div><label>Người cho phép</label><input id="aReleaseBy" list="aByList" autocomplete="off" placeholder="Chọn hoặc gõ tên" value="${escAttr(form.releaseBy||'')}"></div><div><label>Căn cứ cho phép</label><input id="aReleaseNote" placeholder="VD: QC chạy lại đã được chấp nhận" value="${escAttr(form.releaseNote||'')}">${actionSuggestBox('aReleaseNote',ACT_SUGGEST.releaseNote)}</div></div></div>`,actionSectionChip(miss.cause),openSet)}
     ${actionSection('patient','7','Đánh giá ảnh hưởng bệnh nhân','Ghi rõ phạm vi và cách xử lý nếu có liên quan',`<div class="action-patient-grid"><div><label>Kết luận ảnh hưởng</label>${actSel('aPatientImpact','Kết luận ảnh hưởng',ACT_PATIENT_OPTS,form.patientImpact)}</div><div><label>Xử lý mẫu/kết quả liên quan</label><textarea id="aPatientAction" rows="1" placeholder="VD: Rà soát các mẫu từ 08:00–10:00; chạy lại 3 mẫu...">${esc(form.patientAction||'')}</textarea>${actionSuggestBox('aPatientAction',ACT_SUGGEST.patientAction)}</div></div>`,actionSectionChip(miss.patient),openSet)}
     ${actionSection('eff','8','Đánh giá hiệu lực','Làm sau thời gian theo dõi; kết luận “có hiệu lực” cần đánh giá nguy cơ còn lại',`<div class="action-effectiveness-grid"><div><label>Kết luận hiệu lực</label>${actSel('aEffectivenessStatus','Kết luận hiệu lực',ACT_EFF_OPTS,form.effectivenessStatus||'pending')}</div><div class="action-effectiveness-date"><label>Ngày đánh giá</label>${dateBox('aEffectivenessDate',form.effectivenessDate||'','action-date')}</div><div><label>Bằng chứng/nhận xét hiệu lực</label><textarea id="aEffectivenessNote" rows="1" placeholder="VD: Theo dõi 20 lần chạy tiếp theo không tái diễn...">${esc(form.effectivenessNote||'')}</textarea>${actionSuggestBox('aEffectivenessNote',ACT_SUGGEST.effectivenessNote)}</div></div><div class="action-residual-block"><div class="action-release-title"><b>Nguy cơ còn lại sau khắc phục</b><small>Chỉ bắt buộc khi kết luận có hiệu lực; dùng cùng thang điểm và SOP với đánh giá ban đầu</small></div><div class="action-residual-grid"><div><label>Mức độ (S)</label>${actSel('aResidualSeverity','Mức độ còn lại',ACT_SEVERITY_OPTS,form.residualSeverity,'onchange="syncActionResidualRiskScore()"')}</div><div><label>Khả năng xảy ra (O)</label>${actSel('aResidualOccurrence','Khả năng xảy ra còn lại',ACT_OCCURRENCE_OPTS,form.residualOccurrence,'onchange="syncActionResidualRiskScore()"')}</div><div><label>Khả năng không phát hiện (D)</label>${actSel('aResidualDetectability','Khả năng không phát hiện còn lại',ACT_DETECT_OPTS,form.residualDetectability,'onchange="syncActionResidualRiskScore()"')}</div><div><label>Phân loại theo SOP</label>${actSel('aResidualRiskLevel','Phân loại nguy cơ còn lại',ACT_RISK_LEVEL_OPTS,form.residualRiskLevel,'onchange="syncActionResidualRiskScore()"')}</div><div class="action-risk-result"><label>RPN còn lại</label><div id="aResidualRiskScoreCard" class="action-risk-score risk-${escAttr(['low','medium','high','critical'].includes(form.residualRiskLevel)?form.residualRiskLevel:'none')}" aria-live="polite"><b id="aResidualRiskScore">${actionResidualRiskScore(form)||'—'}</b></div></div><div class="action-residual-basis"><label>Căn cứ đánh giá lại</label><input id="aResidualRiskBasis" placeholder="VD: SOP-QC-07; dữ liệu theo dõi sau khắc phục" value="${escAttr(form.residualRiskBasis||'')}">${actionSuggestBox('aResidualRiskBasis',ACT_SUGGEST.residualRiskBasis)}</div></div></div>`,actionEffSectionChip(form),openSet)}
     <div class="action-form-submit"><div><b>${editing?'Cập nhật tiến độ hồ sơ':'Lưu ngay ở trạng thái đang điều tra'}</b><span>Chỉ cần hoàn tất phần nhận diện và kiểm soát tức thời để lưu; phê duyệt chỉ xuất hiện khi hồ sơ đủ điều kiện khép vòng.</span></div><div class="action-submit-buttons">${btn(editing?'Hủy chỉnh sửa':'Đóng','closeActionForm()','ghost')}${btn(editing?'Lưu thay đổi':'Lập hồ sơ NCE','addAction()','teal')}</div></div></div>`}</div>
   <div class="panel action-log-panel"><h3>Nhật ký khắc phục</h3>${rows?`<div class="action-log-tools">${btn('Xuất CSV nhật ký','exportActionsCSV()','teal sm')}</div><div class="action-log-wrap"><table class="action-log-table"><thead><tr><th>Thời điểm</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState('Chưa có nhật ký','Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.')}</div>`;
}

let reportQ='',reportTest='',reportRangeStart='',reportRangeEnd='',reportLockYm='';
/* Khóa kỳ báo cáo: hành động toàn phòng lab (mọi xét nghiệm), tách khỏi phần
   chọn xét nghiệm/khoảng ngày phía trên — PeriodService.lock()/unlock() đã có
   sẵn từ trước và được entry-service.js chặn sửa điểm QC khi kỳ bị khóa, chỉ
   thiếu giao diện gọi tới nên tính năng chưa dùng được trên thực tế. */
function reportLockYmValue(){return/^\d{4}-\d{2}$/.test(reportLockYm)?reportLockYm:isoMonth();}
function reportSetLockPart(part,value){
  const m=/^(\d{4})-(\d{2})$/.exec(reportLockYmValue());
  let year=+m[1],month=+m[2];
  if(part==='year')year=+value;else month=+value;
  reportLockYm=`${year}-${String(month).padStart(2,'0')}`;
  rerender();
}
async function reportLockPeriod(){
  if(!requireAdmin())return;
  const ym=reportLockYmValue(),label=monthVN(ym);
  if(!await confirmDialog({kicker:'Khóa kỳ báo cáo',title:`Khóa kỳ ${label}?`,message:'Sau khi khóa, không ai (kể cả admin) sửa/hủy được điểm QC trong kỳ này ở bất kỳ xét nghiệm nào cho tới khi mở khóa.',detail:'Chỉ nên khóa sau khi đã xuất xong báo cáo chính thức của kỳ.',confirmLabel:'Khóa kỳ',cancelLabel:'Hủy'}))return;
  if(!await reauthenticateCurrentUser({title:'Xác thực khóa kỳ',message:`Nhập lại mật khẩu để khóa kỳ ${label}.`}))return;
  const result=PeriodService.lock(state,{ym,lockedAt:new Date().toISOString(),lockedBy:userName(),id:uid()});
  if(result.error){await infoDialog(result.error==='already-locked'?`Kỳ ${label} đã được khóa từ trước.`:'Không khóa được kỳ này.');return;}
  logAct('Khóa kỳ báo cáo',label,'Kỳ báo cáo');save({clearDerived:false});rerender();
  await infoDialog(`Đã khóa kỳ ${label}.`,{type:'success'});
}
function reportUnlockPeriod(ym){
  if(!requireAdmin())return;
  const label=monthVN(ym);
  openModal(modalTemplate({title:`Mở khóa kỳ ${esc(label)}`,body:`
      <div class="hint">Sau khi mở khóa, điểm QC trong kỳ ${esc(label)} có thể được sửa/hủy trở lại.</div>
      <label>Lý do mở khóa (tối thiểu 5 ký tự)</label>
      <textarea id="unlockReasonInput" placeholder="VD: Bổ sung đối soát, phát hiện sai sót cần chỉnh lại..." oninput="document.getElementById('unlockReasonErr').style.display='none'"></textarea>
      <div id="unlockReasonErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần ghi lý do mở khóa tối thiểu 5 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Xác nhận mở khóa',`reportConfirmUnlockPeriod('${jsq(ym)}')`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('unlockReasonInput');if(e)e.focus();},50);
}
async function reportConfirmUnlockPeriod(ym){
  const input=document.getElementById('unlockReasonInput'),clean=QCCore.cleanText(input?input.value:'',1000).trim();
  if(clean.length<5){
    const err=document.getElementById('unlockReasonErr');
    if(err)err.style.display='';
    if(input)input.focus();
    return;
  }
  closeModal();if(!await reauthenticateCurrentUser({title:'Xác thực mở khóa kỳ',message:`Nhập lại mật khẩu để mở khóa kỳ ${monthVN(ym)}.`}))return;
  const label=monthVN(ym),result=PeriodService.unlock(state,{ym,reason:clean});
  if(result.error){await infoDialog('Kỳ này hiện không bị khóa.');rerender();return;}
  logAct('Mở khóa kỳ báo cáo',`${label} · Lý do: ${clean}`,'Kỳ báo cáo');save({clearDerived:false});rerender();
  await infoDialog(`Đã mở khóa kỳ ${label}.`,{type:'success'});
}
function reportLockListHtml(){
  const locks=[...(state.periodLocks||[])].sort((a,b)=>String(b.ym||'').localeCompare(String(a.ym||'')));
  if(!locks.length)return '<div class="hint">Chưa có kỳ nào được khóa.</div>';
  const isAdmin=role()==='admin';
  return `<div class="period-lock-list">${locks.map(l=>`<div class="period-lock-row"><div><b>Kỳ ${esc(monthVN(l.ym))}</b><span class="hint"> · Khóa bởi ${esc(l.lockedBy||'—')}${l.lockedAt?' lúc '+formatDateTimeVN(l.lockedAt):''}</span></div>${isAdmin?btn('Mở khóa',`reportUnlockPeriod('${jsq(l.ym)}')`,'ghost sm'):''}</div>`).join('')}</div>`;
}
function reportSearchValues(t){
  const levels=operationalLevels(t),panel=operationalPanelForTest(t),lotGroup=operationalLotGroupForTest(t);
  return [
    testSelectLabel(t),
    t.name,t.machine,t.unit,
    panel&&panel.name,
    lotGroup&&lotGroup.name,
    ...levels.map(l=>l.lot)
  ];
}
function reportSearchSet(v){
  reportQ=v;
  scheduleSearchRender(reportSearchSet,reportApplySearch,'reportSearch');
}
function reportApplySearch(){
  const tests=operationalTests(),q=searchText(reportQ),matched=tests.filter(t=>!q||reportSearchValues(t).some(v=>searchText(v).includes(q)));
  if(matched.length&&(!reportTest||!matched.some(t=>t.id===reportTest)))reportTest=matched[0].id;
  if(!matched.length)reportTest='';
  const select=document.getElementById('rTest'),count=document.getElementById('reportTestCount');
  replaceSelectItems(select,matched.map(t=>({value:t.id,label:testSelectLabel(t,tests)})),'Không tìm thấy xét nghiệm phù hợp');
  if(select&&reportTest)select.value=reportTest;
  if(count)count.textContent=`(${matched.length}/${tests.length})`;
  document.querySelectorAll('[data-report-action]').forEach(button=>button.disabled=!matched.length);
}
function reportRangeDefaults(){
  if(!reportRangeStart&&!reportRangeEnd){reportRangeStart=isoMonth()+'-01';reportRangeEnd=isoToday();}
  return{start:reportRangeStart,end:reportRangeEnd};
}
function reportDateRange(){
  const s=parseVN((document.getElementById('rStartDate')||{}).value||'')||'',e=parseVN((document.getElementById('rEndDate')||{}).value||'')||'';
  return(s&&e&&s>e)?{start:e,end:s}:{start:s,end:e};
}
function reportRangeChanged(){
  const{start,end}=reportDateRange();
  reportRangeStart=start;reportRangeEnd=end;
}
function reportRangeText(start,end){
  if(!start&&!end)return'Toàn bộ dữ liệu';
  if(start&&end)return vnDate(start)+' – '+vnDate(end);
  return start?('Từ '+vnDate(start)):('Đến '+vnDate(end));
}
const REPORT_ACTION_ICON_PATHS={
  print:'<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/><path d="M18 12h.01"/>'
};
function reportActionIcon(type){
  const paths=REPORT_ACTION_ICON_PATHS[type];
  return `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
function reportLockPanelHtml(){
  const isAdmin=role()==='admin',ym=reportLockYmValue(),m=/^(\d{4})-(\d{2})$/.exec(ym),year=+m[1],month=+m[2];
  const nowYear=new Date().getFullYear(),yearMin=nowYear-3,yearMax=nowYear+1;
  const monthOptions=Array.from({length:12},(_,i)=>`<option value="${i+1}" ${month===i+1?'selected':''}>Tháng ${i+1}</option>`).join('');
  const yearOptions=Array.from({length:yearMax-yearMin+1},(_,i)=>yearMin+i).map(y=>`<option value="${y}" ${year===y?'selected':''}>${y}</option>`).join('');
  const already=PeriodService.findLock(state,ym);
  return `<div class="panel"><h3>Khóa kỳ báo cáo</h3>
     <div class="hint">Khóa 1 kỳ (theo tháng) sẽ chặn sửa/hủy điểm QC của kỳ đó ở <b>mọi xét nghiệm</b> — nên làm sau khi đã xuất xong báo cáo chính thức của kỳ.</div>
     <div class="grid4" style="margin-top:10px">
       <div><label>Tháng</label><select aria-label="Tháng" ${isAdmin?'':'disabled'} onchange="reportSetLockPart('month',this.value)">${monthOptions}</select></div>
       <div><label>Năm</label><select aria-label="Năm" ${isAdmin?'':'disabled'} onchange="reportSetLockPart('year',this.value)">${yearOptions}</select></div>
       <div style="align-self:end">${isAdmin?(already?btn('Kỳ này đã khóa','','ghost','',{disabled:true}):btn('Khóa kỳ này','reportLockPeriod()','teal')):'<span class="hint">Chỉ admin mới khóa/mở khóa được kỳ báo cáo.</span>'}</div>
     </div>
     <div style="margin-top:16px">${reportLockListHtml()}</div>
   </div>`;
}
function pageReportV2(){
  const tests=operationalTests();
  if(!tests.length)return headOnly('Báo cáo & Biểu mẫu','')+`<div class="panel">${emptyState('Chưa có xét nghiệm đang vận hành','Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`+reportLockPanelHtml();
  const q=searchText(reportQ),matched=tests.filter(t=>!q||reportSearchValues(t).some(v=>searchText(v).includes(q)));
  if(matched.length&&(!reportTest||!matched.some(t=>t.id===reportTest)))reportTest=matched[0].id;
  if(!matched.length)reportTest='';
  const opts=matched.length?matched.map(t=>`<option value="${escAttr(t.id)}" ${t.id===reportTest?'selected':''}>${esc(testSelectLabel(t,tests))}</option>`).join(''):'<option value="">Không tìm thấy xét nghiệm phù hợp</option>';
  const{start,end}=reportRangeDefaults();
  return headOnly('Báo cáo & Biểu mẫu','Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn')+
   `<div class="panel"><h3 role="heading" aria-level="2">Báo cáo nội kiểm theo ngày</h3>
     <div class="grid4"><div><label>Tìm xét nghiệm</label><input id="reportSearch" type="search" placeholder="Tìm tên xét nghiệm" value="${escAttr(reportQ)}" oninput="reportSearchSet(this.value)"></div>
       <div><label>Xét nghiệm <span id="reportTestCount" class="hint">(${matched.length}/${tests.length})</span></label><select id="rTest" aria-label="Xét nghiệm" ${matched.length?'':'disabled'} onchange="reportTest=this.value">${opts}</select></div>
       ${reportRangePicker(start,end)}</div>
     <div class="report-actions">
       ${btn(reportActionIcon('print')+'Tạo báo cáo &amp; In','printReport()','teal','',{disabled:!matched.length,attrs:{'data-report-action':''}})}
       ${btn('Xuất Excel','exportReportXLSX()','teal','',{disabled:!matched.length,attrs:{'data-report-action':''}})}
       ${btn('Xuất CSV','exportReportCSV()','teal','',{disabled:!matched.length,attrs:{'data-report-action':''}})}
     </div>
   </div>`+reportLockPanelHtml();
}
function reportRangePicker(start,end){
  return `<div><label>Từ ngày</label>${dateBox('rStartDate',start,'','onchange="reportRangeChanged()"')}</div>
    <div><label>Đến ngày</label>${dateBox('rEndDate',end,'','onchange="reportRangeChanged()"')}</div>`;
}
