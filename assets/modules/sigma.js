/* ===== SIX SIGMA (chuẩn EQC: Sigma=(TEa-|Bias EQC|)/CV IQC) =====
   Lớp giải TEa (bảng TEa hiệu lực, khớp xét nghiệm ↔ dòng tham chiếu, quy tắc
   CLIA, ảnh chụp truy vết TEa) đã tách sang sigma-tea.js ngày 2026-08-01 — nạp
   ngay trước file này. Đừng đưa ngược các hàm sgTea…, effectiveTeaRefs() hay
   sgRef() về đây: tests/ui-route-structure.test.js chốt lại ranh giới đó. */
let sgCohortCtx=null;
function sgZone(s){if(s>=6)return{c:'#13603f',label:'Đẳng cấp thế giới'};if(s>=5)return{c:'#2c7d5c',label:'Xuất sắc'};if(s>=4)return{c:'#3f9a55',label:'Tốt'};if(s>=3)return{c:'#dd8b1f',label:'Cận biên'};return{c:'#c0362c',label:'Không đạt'};}
function sgRun(s){if(!isFinite(s))return null;if(s>=6)return{risk:'Thấp',plan:'Thiết kế QC theo đánh giá nguy cơ; không tự động giảm tần suất.'};if(s>=5)return{risk:'Thấp–trung bình',plan:'Xác nhận bằng dữ liệu ổn định và SOP trước khi đơn giản hóa QC.'};if(s>=4)return{risk:'Trung bình',plan:'Cân nhắc đa quy tắc và tăng giám sát theo nguy cơ.'};if(s>=3)return{risk:'Cao',plan:'Tăng cường QC và ưu tiên cải thiện phương pháp.'};return{risk:'Rất cao',plan:'Không dùng Sigma để hợp thức hóa vận hành; cần khắc phục phương pháp.'};}
function sgFmtDPMO(n){return !isFinite(n)?'—':(n<10?n.toFixed(2):n<1000?n.toFixed(0):Math.round(n).toLocaleString('en-US'));}
function sgData(tid){state.sigmaData=state.sigmaData||{};state.sigmaData[tid]=state.sigmaData[tid]||[];return state.sigmaData[tid];}
const SG_BIAS_LABEL='Bias EQA/EQC';
function sgInputValue(v){return escAttr(v??'');}
function sgInputDisplayValue(v,digits=2){if(v==null||String(v).trim()==='')return'';const n=Number(v);return Number.isFinite(n)?n.toFixed(digits):'';}
function sgCleanCell(field,val){
  if(['cv','biasEqa'].includes(field)){const s=String(val??'').trim();if(s==='')return'';const n=Number(s);return Number.isFinite(n)?n:'';}
  return QCCore.cleanText(val,120);
}
function sgBiasVal(L){return L.biasEqa??L.bias;}
function sgIsAutoCV(L){return!!L&&['iqc-period','iqc-cohort'].includes(L.cvSource);}
function sgReadiness(L){if(!sgIsAutoCV(L))return{status:'manual',label:'CV nhập tay — chưa xác nhận bằng nhóm dữ liệu IQC cùng lô/mức',classifiable:true,qcpEligible:false};const status=['insufficient','provisional','eligible','unstable'].includes(L.cohortStatus)?L.cohortStatus:(+L.n<20?'insufficient':+L.n<30?'provisional':'eligible');if(status==='insufficient')return{status,label:'Chưa đủ 20 điểm QC',classifiable:false,qcpEligible:false};if(status==='unstable')return{status,label:'Nhóm dữ liệu IQC không ổn định',classifiable:false,qcpEligible:false};if(status==='provisional')return{status,label:'Kết quả tạm thời (20–29 điểm)',classifiable:true,qcpEligible:false};return{status:'eligible',label:'Đủ điều kiện dữ liệu',classifiable:true,qcpEligible:true};}
/* ===== Độ không đảm bảo đo (MU) — ISO 15189:2022 §7.3.4 =====
   Toán nằm ở QCCore.uncertaintyBudget(); phần này chỉ nối các đầu vào ĐÃ CÓ của
   trang Sigma vào đó: CV cohort một lô → u(Rw), các vòng EQA → u(bias), CoA
   calibrator do người dùng nhập → u(cal). */
/* u(Cref) của chính ước lượng Bias: sai số chuẩn của trung bình các vòng EQA
   (SD giữa các vòng / √n). Một vòng duy nhất không có độ phân tán để ước lượng
   — trả null, ngân sách khi đó chỉ còn |bias| đúng như Nordtest TR 537 cho phép. */
function sgBiasRefU(rounds){
  const b=sgBiasStats(rounds).valid.map(r=>r.bias);if(b.length<2)return null;
  const m=b.reduce((s,v)=>s+v,0)/b.length,sd=Math.sqrt(b.reduce((s,v)=>s+(v-m)*(v-m),0)/(b.length-1));
  return Number.isFinite(sd)?sd/Math.sqrt(b.length):null;
}
function sgMuBiasMode(L){return L&&L.muBiasMode==='exclude'?'exclude':'include';}
/* MU phải tính TỪ CÙNG MỘT CHỖ cho màn hình, báo cáo in và Excel: sgComp() gắn
   sẵn kết quả vào r.mu, còn panel gọi lại sgMU() cho những mức chưa ra Sigma —
   thiếu Bias thì sgComp() trả null nhưng MU vẫn phải hiện kèm cờ thiếu thành phần,
   vì một ngân sách còn hở chính là thứ đánh giá viên cần nhìn thấy. */
function sgMU(t,e,level,tea,refs){
  const L=(e&&e.lv&&e.lv[level])||{},teaNum=Number(tea);
  return QCCore.uncertaintyBudget({cv:L.cv,bias:sgBiasVal(L),biasRefU:sgBiasRefU(L.eqaRounds),uCal:L.uCal,
    includeBias:sgMuBiasMode(L)==='include',
    tea:Number.isFinite(teaNum)&&teaNum>0?teaNum:sgEntryTea(t,e,level,refs),
    target:sgLevelTarget(t,L,level),k:2});
}
function sgComp(t,e,level,refs){const L=(e.lv&&e.lv[level])||{},cv=parseFloat(L.cv),b=parseFloat(sgBiasVal(L)),tea=sgEntryTea(t,e,level,refs),metric=QCCore.sigmaMetric(tea,b,cv);if(!metric)return null;const{sigma,dpmo}=metric,ready=sgReadiness(L),zone=ready.classifiable?sgZone(sigma):{c:'#6b756f',label:ready.label},warnings=[],meta=sgTeaSourceMeta(t,e.teaSource||sgTeaSource(t));if(Math.abs(b)>=tea)warnings.push('|Bias| đã bằng hoặc vượt TEa');if(ready.status!=='eligible')warnings.push(ready.label);return{cv,bias:b,biasMethod:L.biasEqaMethod||'manual',biasLabel:L.biasEqaMethod==='rms'?SG_BIAS_LABEL+' (RMS)':SG_BIAS_LABEL,tea,teaTarget:Number.isFinite(+L.teaTarget)?+L.teaTarget:null,teaCriterionRule:L.teaCriterionRule||'',teaCriterionPercent:Number.isFinite(+L.teaCriterionPercent)?+L.teaCriterionPercent:null,teaCriterionAbsolute:Number.isFinite(+L.teaCriterionAbsolute)?+L.teaCriterionAbsolute:null,teaCriterionUnit:L.teaCriterionUnit||'',teaSource:e.teaSource||sgTeaSource(t),teaLabel:e.teaLabel||sgTeaLabel(sgTeaSource(t)),teaReference:e.teaReference||sgTeaRefText(t),teaSourceId:e.teaSourceId||meta.id||'',teaSourceVersion:e.teaSourceVersion||meta.version||'',teaSourceUrl:e.teaSourceUrl||meta.url||'',teaEffectiveDate:e.teaEffectiveDate||meta.effectiveDate||'',teaReviewedDate:e.teaReviewedDate||meta.reviewedDate||'',teaReviewedBy:e.teaReviewedBy||meta.reviewedBy||'',cvSource:L.cvSource||'manual',n:Number.isFinite(+L.n)?+L.n:null,sourceStart:L.sourceStart||'',sourceEnd:L.sourceEnd||'',sourceLot:L.sourceLot||'',cohortStatus:ready.status,classifiable:ready.classifiable,qcpEligible:ready.qcpEligible,readinessLabel:ready.label,warning:warnings.join(' · ')||null,mu:sgMU(t,e,level,tea,refs),muBiasMode:sgMuBiasMode(L),uCalBasis:L.uCalBasis||'',muReviewedBy:L.muReviewedBy||'',muReviewedDate:L.muReviewedDate||'',sigma,dpmo,yld:metric.yieldPercent,dse:sigma-1.65,run:ready.qcpEligible?sgRun(sigma):null,...zone};}
/* Dựng effectiveTeaRefs() một lần cho cả lượt (mọi kỳ × mọi mức của xét nghiệm
   đang xem) thay vì để mỗi ô tự build lại — bảng TEa hiệu lực không đổi trong
   một lượt render. sgPendingRows cache kết quả cho đúng MỘT lần sgRefresh() gọi
   ngay sau pageSigma() (qua rAF ở after-render.js); mọi lần gọi sgRows() khác
   (sửa ô, đổi kỳ, ...) luôn tính lại từ dữ liệu hiện hành. */
let sgPendingRows=null;
function sgRows(t,data,levels){const refs=effectiveTeaRefs();return(data||[]).map(e=>({e,rs:levels.map(l=>sgComp(t,e,l,refs))})).sort((a,b)=>String(a.e.period||'').localeCompare(String(b.e.period||'')));}
function sgSyncCurrentPeriodTea(t){
  const e=t&&sgData(t.id).find(x=>x.period===isoMonth());if(!e)return null;
  const next=sgTeaSnapshot(t),keys=['tea','teaSource','teaLabel','teaReference','teaSourceId','teaSourceVersion','teaSourceUrl','teaEffectiveDate','teaReviewedDate','teaReviewedBy'];
  let changed=keys.some(k=>String(e[k]??'')!==String(next[k]??''));
  if(changed){['tea','teaSource','teaLabel','teaReference','teaCapturedAt','teaSourceId','teaSourceVersion','teaSourceUrl','teaEffectiveDate','teaReviewedDate','teaReviewedBy'].forEach(k=>delete e[k]);Object.assign(e,next);}
  Object.keys(e.lv||{}).forEach(level=>{const before=JSON.stringify(e.lv[level]);sgSetLevelTeaSnapshot(t,e,level,true);if(before!==JSON.stringify(e.lv[level]))changed=true;});
  return changed?e:null;
}
/* Đồng bộ TEa snapshot cho MỌI xét nghiệm đang track Sigma — gọi tại các điểm dữ
   liệu THỰC SỰ thay đổi (ensureShape() ở state.js: boot/merge Firebase/nhập
   backup; và các hàm sửa Bảng TEa tham chiếu ở manage-routes.js), thay vì để
   pageSigma() tự phát hiện+ghi mỗi lần render — cách cũ khiến bất kỳ ai làm
   pageSigma() chạy lại (kể cả Firebase dội dữ liệu về) đều có thể kéo theo một
   lượt save()/rerender() ẩn ngay lúc người dùng chỉ đang xem, từng gây giật cuộn.
   pageSigma() giờ chỉ đọc, không còn side-effect khi vẽ giao diện. */
function sgReconcileAllTeaSnapshots(){
  let changed=false;
  sgTrackedTests().forEach(t=>{if(sgSyncCurrentPeriodTea(t))changed=true;});
  return changed;
}
function sgSetTea(v){if(!requireWrite())return;const t=state.tests.find(x=>x.id===sgTest);if(!t)return;const s=String(v??'').trim(),n=Number(s);t.tea=s&&Number.isFinite(n)&&n>0?n:0;sgSyncCurrentPeriodTea(t);save({clearDerived:false,sigmaTestId:sgTest});rerender();}
function sgSetTeaSource(v){if(!requireWrite())return;const t=state.tests.find(x=>x.id===sgTest);if(!t)return;t.teaSource=SG_TEA_SOURCES.some(x=>x[0]===v)?v:'ricos';if(t.teaSource==='eflm'){if(!t.eflmAnalyte)t.eflmAnalyte=t.name||'';if(!t.eflmAps)t.eflmAps='desirable';}sgSyncCurrentPeriodTea(t);save({clearDerived:false,sigmaTestId:sgTest});rerender();}
function sgSetTeaMeta(field,val){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===sgTest);if(!t)return;
  if(field==='eflmLookupDate')t[field]=parseVN(val)||'';
  else if(field==='eflmAps')t[field]=['minimum','desirable','optimum'].includes(val)?val:'desirable';
  else if(['eflmAnalyte','eflmRef'].includes(field))t[field]=QCCore.cleanText(val,field==='eflmRef'?500:160);
  sgSyncCurrentPeriodTea(t);
  save({clearDerived:false,sigmaTestId:sgTest});rerender();
}
function sgRefreshSoon(){clearTimeout(sgRefreshT);sgRefreshT=setTimeout(()=>{if(page==='sigma')sgRefresh();},80);}
function sgTrackedTests(){return(state.tests||[]).filter(t=>t.sgTracked).sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b)||String(a.name||'').localeCompare(String(b.name||'')));}
function sgTrackedOptions(tests,selectedId){return tests.map(x=>`<option value="${x.id}" ${x.id===selectedId?'selected':''}>${esc(testDisplayName(x))}</option>`).join('');}
/* Sigma theo kỳ phải giữ được các mức từng có dữ liệu, kể cả khi nhóm lô hiện đã
   dừng. operationalLevels() chỉ mô tả khả năng NHẬP QC hôm nay nên không thể dùng
   làm nguồn duy nhất cho màn lịch sử. */
function sgHistoricalLevels(t){
  const out=new Set(),add=v=>{const n=Number(v);if(Number.isFinite(n)&&n>0)out.add(n);};
  if(typeof operationalLevels==='function')operationalLevels(t).forEach(l=>add(l.level));
  (t&&t.levels||[]).forEach(l=>{if(l.qcLotId||Number.isFinite(+l.sd)&&+l.sd>0||(l.meanSdHistory||[]).length)add(l.level);});
  ((state.data&&t&&state.data[t.id])||[]).forEach(p=>add(p&&p.level));
  (t?sgData(t.id):[]).forEach(e=>Object.keys(e&&e.lv||{}).forEach(add));
  return[...out].sort((a,b)=>a-b);
}
function sgVisibleLevels(t){return sgHistoricalLevels(t);}
function sgPeriodLevels(t,e){
  const out=new Set(),add=v=>{const n=Number(v);if(Number.isFinite(n)&&n>0)out.add(n);},period=SigmaCohortService.normalizePeriod(e&&e.period),start=period?period+'-01':'',end=period?sgCohortCutoff(period):'';
  Object.keys(e&&e.lv||{}).forEach(add);
  ((state.data&&t&&state.data[t.id])||[]).forEach(p=>{const d=String(p&&p.date||'');if((!start||d>=start)&&(!end||d<=end))add(p&&p.level);});
  if(!out.size)sgHistoricalLevels(t).forEach(add);
  return[...out].sort((a,b)=>a-b);
}
function sgPickTest(v){if(!v)return;sgTest=v;rerender();}
function sgStatusPeriodId(tid,data){
  const selected=sgSelectedPeriods&&sgSelectedPeriods[tid];if(selected&&(data||[]).some(e=>e.id===selected))return selected;
  const latest=[...(data||[])].sort((a,b)=>String(a.period||'').localeCompare(String(b.period||''))).pop(),fallback=latest&&latest.id||'';
  if(fallback)sgSelectedPeriods[tid]=fallback;else if(sgSelectedPeriods)delete sgSelectedPeriods[tid];return fallback;
}
function sgSelectPeriod(eid){
  if(!sgTest||!sgData(sgTest).some(e=>e.id===eid))return;
  if(sgSelectedPeriods[sgTest]===eid)return; // đã chọn sẵn → khỏi refresh thừa khi bấm vào cùng hàng
  sgSelectedPeriods[sgTest]=eid;
  document.querySelectorAll('[data-sg-period-id]').forEach(row=>{const on=row.dataset.sgPeriodId===eid;row.classList.toggle('sg-period-selected',on);row.setAttribute('aria-selected',on?'true':'false');});
  sgRefresh();
}
function sgRemoveTracked(id){
  if(!requireAdmin())return;const t=state.tests.find(x=>x.id===id);if(!t)return;
  t.sgTracked=false;
  if(sgTest===id){const remain=sgTrackedTests();sgTest=remain.length?remain[0].id:null;}
  save({clearDerived:false});rerender();
}
function sgOpenAddTest(){if(!requireAdmin())return;sgAddTestQ='';sgRenderAddTestModal();}
function sgAddTestSearchSet(v){sgAddTestQ=v;scheduleSearchRender(sgAddTestSearchSet,sgRenderAddTestModal,'sgAddTestSearch');}
function sgViewTrackedTest(id){const t=state.tests.find(x=>x.id===id);if(!t||!t.sgTracked)return;sgTest=t.id;closeModal();rerender();}
function sgRenderAddTestModal(){
  const all=[...(state.tests||[])].sort((a,b)=>operationalTestOrder(a)-operationalTestOrder(b)||String(testDisplayName(a)).localeCompare(String(testDisplayName(b)),'vi')),q=searchText(sgAddTestQ);
  const matched=all.filter(t=>!q||[testDisplayName(t),t.name,t.machine,t.unit,t.section,t.method].some(v=>searchText(v).includes(q)));
  const rows=matched.map(t=>{const tracked=!!t.sgTracked,current=tracked&&t.id===sgTest,meta=[t.machine,t.unit,t.section].filter(Boolean).map(esc).join(' · ')||'Chưa có thông tin máy/đơn vị',action=tracked?`sgViewTrackedTest('${jsq(t.id)}')`:`sgTrackTest('${jsq(t.id)}')`,label=current?'Đang xem':tracked?'Xem':'Thêm';return `<button class="refrow sg-add-test-row${tracked?' is-tracked':''}${current?' is-current':''}" ${current?'aria-current="true"':''} onclick="${action}"><span><b>${esc(testDisplayName(t))}</b><span class="meta">${meta}</span></span><span class="tag ${tracked?'ok':'none'}">${label}</span></button>`;}).join('');
  const empty=!all.length?'<div class="empty"><div class="empty-title">Chưa có xét nghiệm trong Cấu hình chung</div><div>Hãy nhập xét nghiệm tại Cấu hình chung › Danh mục xét nghiệm trước khi thêm vào Six Sigma.</div></div>':`<div class="empty">${q?'Không tìm thấy xét nghiệm phù hợp.':'Không có xét nghiệm để hiển thị.'}</div>`;
  openModal(`<div class="modal"><div class="modal-h"><h3>Chọn hoặc thêm xét nghiệm vào Six Sigma</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">${all.length?`<input id="sgAddTestSearch" type="search" placeholder="Tìm tên xét nghiệm, máy hoặc đơn vị..." value="${escAttr(sgAddTestQ)}" oninput="sgAddTestSearchSet(this.value)">`:''}
      <div class="sg-add-test-list">${rows||empty}</div></div>
    <div class="modal-f">${btn('Đóng','closeModal()','ghost')}</div></div>`);
  setTimeout(()=>{const e=document.getElementById('sgAddTestSearch');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length);}},0);
}
function sgTrackTest(id){if(!requireAdmin())return;const t=state.tests.find(x=>x.id===id);if(!t)return;t.sgTracked=true;sgTest=t.id;save({clearDerived:false});closeModal();rerender();}
function pageSigma(){
  const tests=sgTrackedTests();
  const addBtn=role()==='admin'?btn('+ Thêm xét nghiệm','sgOpenAddTest()','teal'):'';
  if(!tests.length)return headOnly('Six Sigma & Sai số','')+`<div class="panel">${emptyState('Chưa có xét nghiệm nào trong Sigma',role()==='admin'?((state.tests||[]).length?'Bấm "+ Thêm xét nghiệm" để chọn từ danh mục đã khai báo trong Cấu hình chung.':'Chưa có xét nghiệm trong Cấu hình chung. Hãy khai báo xét nghiệm trước rồi quay lại Six Sigma.'):'Liên hệ quản trị viên để thêm xét nghiệm từ Cấu hình chung.',addBtn)}</div>`;
  if(!sgTest||!tests.find(t=>t.id===sgTest))sgTest=tests[0].id;
  const t=tests.find(t=>t.id===sgTest);
  const trashIcon='<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>',printIcon='<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>',calcIcon='<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><circle cx="8" cy="12" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r=".6" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r=".6" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r=".6" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r=".6" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r=".6" fill="currentColor" stroke="none"/></svg>';
  const combinedExport=sgData(t.id).length?btn(icoDownload()+'Xuất Excel tổng hợp','exportSigmaPeriodsXLSX()','teal sg-combined-export','Xuất báo cáo Excel tổng hợp để so sánh Sigma giữa các kỳ')+btn(printIcon+'Xuất PDF tổng hợp','printSigmaPeriods()','teal sg-combined-print','Tạo bản in PDF/HTML tổng hợp để so sánh Sigma giữa các kỳ'):'';
  const testActions=`${role()==='admin'?btn('+ Thêm','sgOpenAddTest()','teal'):''}${role()==='admin'?btn(trashIcon+'Xóa',`sgRemoveTracked('${t.id}')`,'danger'):''}`;
  const testSelectFields=`<div class="sg-test-picker"><label>Chọn xét nghiệm</label><select id="sgTestSelect" aria-label="Chọn xét nghiệm" onchange="sgPickTest(this.value)">${sgTrackedOptions(tests,sgTest)}</select></div><div class="sg-inline-btns"><label>&nbsp;</label><div class="sg-inline-btns-row">${testActions}</div></div>`;
  const levels=sgVisibleLevels(t);
  if(!levels.length)return headOnly('Six Sigma & Sai số','Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC')+
    `<div class="panel"><div class="row-flex sg-control-row">${testSelectFields}</div>
     <div class="alert warn" style="margin-top:10px">Xét nghiệm này chưa có mức QC hoặc dữ liệu IQC lịch sử để tính Sigma. Hãy kiểm tra Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trong Cấu hình chung.${role()==='admin'?' '+btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):''}</div></div>`;
  const isOperational=operationalLevels(t).length>0;
  const data=sgData(t.id);const ro=!canWrite()?'disabled':'';
  const teaSrc=sgTeaSource(t),teaVal=sgTea(t);
  const teaHint=teaSrc==='clia'?`Tiêu chí CLIA đang dùng: ${sgTeaCriterionText(t,'clia')}. TEa% được tính riêng tại Mean mục tiêu của từng mức QC.`:teaVal?`TEa đang dùng: ${fmt(teaVal,2)}% · nguồn ${sgTeaLabel(teaSrc)}.`:(teaSrc==='eflm'?'Chọn EFLM thì cần tra database EFLM và nhập TEa% cùng thông tin truy xuất.':teaSrc==='lab'?'Xét nghiệm này chưa có TEa chuẩn hóa. Hãy cập nhật tại Cấu hình chung › Bảng TEa tham chiếu.':'Chưa có TEa% cho nguồn đang chọn. Hãy chọn nguồn khác hoặc cập nhật danh mục tham chiếu.');
  const teaOpts=SG_TEA_SOURCES.map(([v,txt])=>{const val=sgTeaBySource(t,v),extra=v==='clia'?` · ${sgTeaCriterionText(t,v)}`:val?` · ${fmt(val,2)}%`:' · chưa có';return `<option value="${v}" ${teaSrc===v?'selected':''}>${txt}${extra}</option>`;}).join('');
  const teaControl=teaSrc==='eflm'?`<label>TEa% EFLM</label><input type="number" step="any" aria-label="TEa% EFLM" title="Nhập TEa% đã tra từ EFLM Database" value="${teaVal||''}" ${canWrite()?'':'disabled'} onchange="sgSetTea(this.value)">`:`<label>${teaSrc==='clia'?'Tiêu chí CLIA':'TEa% tham chiếu'}</label><input type="text" aria-label="${teaSrc==='clia'?'Tiêu chí CLIA':'TEa% tham chiếu'}" value="${escAttr(teaSrc==='clia'?sgTeaCriterionText(t,'clia'):(teaVal?fmt(teaVal,2)+'%':''))}" disabled>`;
  const eflmApsOpts=['minimum','desirable','optimum'].map(v=>`<option value="${v}" ${(t.eflmAps||'desirable')===v?'selected':''}>${v}</option>`).join('');
  const eflmBox=teaSrc==='eflm'?`<div class="sg-eflm-box">
       <div><label>Analyte trên EFLM</label><input ${ro} value="${escAttr(t.eflmAnalyte||t.name||'')}" placeholder="VD: Glucose" onchange="sgSetTeaMeta('eflmAnalyte',this.value)"></div>
       <div><label>Mức APS</label><select ${ro} onchange="sgSetTeaMeta('eflmAps',this.value)">${eflmApsOpts}</select></div>
       <div><label>Ngày tra cứu</label>${dateBox('sgEflmLookupDate',t.eflmLookupDate||'','manage-date',`${ro} onchange="sgSetTeaMeta('eflmLookupDate',this.value)"`)}</div>
       <div><label>Link/tài liệu EFLM</label><input ${ro} value="${escAttr(t.eflmRef||'')}" placeholder="biologicalvariation.eu / bản in PDF" onchange="sgSetTeaMeta('eflmRef',this.value)"></div>
     </div>`:'';
  const selectedPeriodId=sgStatusPeriodId(t.id,data),levelIndex=new Map(levels.map((level,i)=>[level,i])),pageRows=sgRows(t,data,levels),pageRowMap=new Map(pageRows.map(row=>[row.e.id,row]));
  sgPendingRows={tid:t.id,data,rows:pageRows};
  const cvMeta=L=>sgIsAutoCV(L)?`<div class="sg-cell-meta sg-cv-meta" title="${escAttr(`Số điểm IQC: ${L.n||0}${L.sourceLot?' · Lô: '+L.sourceLot:''}${L.sourceStart&&L.sourceEnd?' · '+vnDate(L.sourceStart)+'–'+vnDate(L.sourceEnd):''}`)}">${L.n||0} điểm${L.sourceLot?' · Lô '+esc(L.sourceLot):''}</div>`:'';
  const levelCells=(e,l)=>{const L=(e.lv&&e.lv[l])||{},bias=sgBiasVal(L),row=pageRowMap.get(e.id),r=row?row.rs[levelIndex.get(l)]:sgComp(t,e,l);return `<td class="sg-group-start"><div class="sg-cell-stack"><input class="sg-number" ${ro} type="number" step="any" value="${sgInputValue(sgInputDisplayValue(L.cv))}" placeholder="CV%" oninput="sgCell('${e.id}',${l},'cv',this.value)">${cvMeta(L)}</div></td>
      <td><div class="sg-cell-stack"><input class="sg-number" ${ro} type="number" step="any" value="${sgInputValue(sgInputDisplayValue(bias))}" placeholder="Bias%" oninput="sgCell('${e.id}',${l},'biasEqa',this.value)"><div class="sg-cell-meta sg-cell-meta-empty" aria-hidden="true">&nbsp;</div></div></td>
      <td class="sg-result-cell" title="${r?escAttr((r.biasLabel||'')+' '+fmt(r.bias,2)+'%'+(r.warning?' · '+r.warning:'')):'Nhập CV và Bias'}"><div class="sg-cell-stack"><span id="sg_${e.id}_${l}" class="tag ${r?'sg-zone '+(r.classifiable?(r.sigma>=3?'ok':'rej'):'none'):''}" style="${r?'--sg-color:'+r.c+';color:'+r.c:''}">${r?(r.classifiable?'':'≈')+fmt(r.sigma,2):'—'}</span><div class="sg-cell-meta" style="${r?'color:'+r.c:''}">${r?esc(r.label):'Chưa đủ dữ liệu'}</div></div></td>`;};
  const rows=data.map(e=>{const periodLabel=vnPeriod(e.period)||e.period||'',selected=e.id===selectedPeriodId;return `<tr data-sg-period-id="${escAttr(e.id)}" class="sg-period-row${selected?' sg-period-selected':''}" tabindex="0" aria-selected="${selected?'true':'false'}" aria-label="Chọn kỳ ${escAttr(periodLabel)} để xem tình trạng" onclick="sgSelectPeriod('${e.id}')" onkeydown="if((event.key==='Enter'||event.key===' ')&&event.target===event.currentTarget){event.preventDefault();sgSelectPeriod('${e.id}')}"><td class="sg-period-cell"><div class="sg-period-select-wrap">${sgPeriodSel(e,ro)}</div></td>${levels.map(l=>levelCells(e,l)).join('')}<td class="sg-row-action sg-action-col"><div class="sg-row-action-buttons">${canWrite()?btn('Nạp CV lô',`sgPullCV('${e.id}')`,'ghost sm sg-row-cv',`Chọn CV IQC theo lô lịch sử cho kỳ ${escAttr(periodLabel)}`):''}${btn(icoDownload()+'Excel',`exportSigmaPeriodXLSX('${e.id}')`,'ghost sm sg-row-export',`Xuất Excel riêng kỳ ${escAttr(periodLabel)}`)}${btn(printIcon+'In PDF',`printSigmaPeriod('${e.id}')`,'ghost sm sg-row-print',`Tạo bản in PDF/HTML riêng kỳ ${escAttr(periodLabel)}`)}${role()==='admin'?btn('Xóa',`sgDelPeriod('${e.id}')`,'danger sm sg-row-delete',`Xóa kỳ ${escAttr(periodLabel)}`):''}</div></td></tr>`;}).join('');
  const tableHead=`<thead><tr><th rowspan="2">Kỳ / Năm</th>${levels.map(l=>`<th colspan="3" class="sg-group-start">Mức ${l}</th>`).join('')}<th rowspan="2" class="sg-action-col">Thao tác</th></tr><tr>${levels.map(()=>'<th class="sg-group-start">CV IQC%</th><th>Bias EQA%</th><th>Sigma</th>').join('')}</tr></thead>`;
  const colGroup=`<colgroup><col style="width:140px">${levels.flatMap(()=>['<col style="width:100px">','<col style="width:100px">','<col style="width:95px">']).join('')}<col style="width:228px"></colgroup>`,tableMin=368+levels.length*295,latestEntry=[...data].sort((a,b)=>String(a.period||'').localeCompare(String(b.period||''))).pop();
  const biasActions=canWrite()?levels.map(l=>btn(`${calcIcon}Bias EQA% Mức ${l}`,latestEntry?`sgOpenBias('${latestEntry.id}',${l})`:'','ghost sm',latestEntry?`Tính Bias EQA/EQC Mức ${l} cho kỳ ${escAttr(latestEntry.period||'mới nhất')}`:'Hãy thêm kỳ trước khi tính Bias',{disabled:!latestEntry})).join(''):'';
  const addPeriodAction=canWrite()?btn('+ Thêm kỳ','sgAddPeriod()','teal sm'):'';
  const headerActions=biasActions+addPeriodAction;
  return headOnly('Six Sigma & Sai số','Đánh giá hiệu năng phương pháp theo TEa, CV IQC và Bias EQA/EQC')+
   `<div class="sg-top-grid"><div class="panel"><h3 class="sg-setup-heading" role="heading" aria-level="2">Thiết lập phân tích</h3><div class="row-flex sg-control-row">${testSelectFields}</div>
     <div class="sg-setup-fields">
       <div><label>Tên xét nghiệm</label><input value="${escAttr(testDisplayName(t))}" aria-label="Tên xét nghiệm" readonly></div>
       <div><label>Đơn vị</label><input value="${escAttr(t.unit||'')}" aria-label="Đơn vị" readonly></div>
       <div><label>Thiết bị</label><input value="${escAttr(instrumentName(t.instrumentId,t.machine)||'Chưa gán thiết bị')}" readonly placeholder="Bấm để chọn / quản lý thiết bị"></div>
       <div class="sg-tea-source"><label>Nguồn TEa</label><select aria-label="Nguồn TEa" ${!canWrite()?'disabled':''} onchange="sgSetTeaSource(this.value)">${teaOpts}</select></div>
       <div class="sg-tea-input">${teaControl}</div>
     </div>
     ${eflmBox}
      <div class="hint sg-sigma-input-note">${esc(teaHint)} Mỗi mức dùng <b>CV từ IQC</b> và <b>Bias từ EQA/EQC</b>; nhiều vòng EQA được tổng hợp bằng <b>RMS</b> để tránh triệt tiêu dấu. Dữ liệu IQC không được dùng để tính Bias. Quy tắc thận trọng của phần mềm: &lt;20 điểm chỉ hiển thị ước tính, 20–29 điểm là tạm thời, ≥30 điểm mới dùng để gợi ý QC. DPMO/Yield chỉ là quy đổi tham khảo với dịch 1,5σ.${isOperational?'':' Nhóm lô hiện không vận hành; các kỳ cũ vẫn lấy CV theo đúng lô và Mean/SD đã lưu trong lịch sử IQC.'}</div></div>
   <div class="panel"><h3 class="sg-setup-heading">Tình trạng</h3><div id="sgStatus"></div></div></div>
   <div class="panel"><div class="sg-data-head"><h3>Số liệu theo kỳ</h3><div class="sg-data-head-actions">${headerActions}</div></div>
     ${data.length?`<div class="sg-simple-table-wrap"><table class="sg-simple-table" style="min-width:${tableMin}px">${colGroup}${tableHead}<tbody>${rows}</tbody></table></div>`:'<div class="empty" style="margin:14px 16px 10px">Chưa có kỳ nào.</div>'}
     ${combinedExport?`<div class="sg-data-foot">${combinedExport}</div>`:''}
    </div>
   <details class="panel sg-collapse-panel"><summary class="sg-collapse-summary"><span>Thiết kế QC theo Sigma (OPSpecs)</span></summary><div class="sg-collapse-body" id="sgFreq"></div></details>
   <details class="panel sg-collapse-panel sg-mu-panel"><summary class="sg-collapse-summary"><span>Độ không đảm bảo đo (MU) — ISO 15189:2022</span><div id="sgMUAction" class="sg-data-head-actions" onclick="event.stopPropagation()"></div></summary><div id="sgMU"></div></details>
   <div class="panel"><h3>Biểu đồ Sigma & MDC</h3><div class="sg-chart-grid">
     <div class="sg-chart-box"><h4>Xu hướng Sigma theo kỳ</h4><div class="chart-inner" id="sgTrend"></div></div>
     <div class="sg-chart-box"><h4>Biểu đồ Quyết định Phương pháp (MDC)</h4><div class="hint">X = CV/TEA, Y = |BIAS|/TEA. Điểm to nhất là kỳ gần nhất.</div><div class="chart-inner" id="sgMDC"></div></div>
   </div></div>`;
}
function sgOpSpecCell(spec){
  if(!spec)return '<span class="muted">—</span>';
  if(!spec.capable)return '<span style="color:var(--red);font-weight:700">Phương pháp chưa đủ năng lực (&lt;3σ)</span>';
  const nr='N='+spec.n+(spec.r>1?' · R='+spec.r:'')+' điểm/lần chạy';
  return `<b>${spec.rules.join(' / ')}</b><div style="font-size:11px;color:var(--muted)">${nr}${spec.single?' · chỉ 1 quy tắc':''}${spec.marginal?' · tối đa + cải thiện PP':''}</div>`;
}
function sgFrequencyHTML(t,selectedRow,levels){
  if(!selectedRow)return '<div class="hint">Chưa có kỳ Sigma để đánh giá đầu vào QC.</div>';
  const last=selectedRow,periodHint=`<div class="hint sg-selected-period-hint">Kỳ đang xem: <b>${vnPeriod(last.e.period)||'?'}</b></div>`;
  let govSigma=Infinity;
  const rows=levels.map((l,i)=>{const r=last.rs[i];if(!r)return `<tr><td>Mức ${l}</td><td class="num">—</td><td>—</td><td>Chưa đủ CV/Bias</td><td>Chưa đánh giá</td></tr>`;
    if(!r.qcpEligible)return `<tr><td>Mức ${l}</td><td class="num">${fmt(r.sigma,2)}</td><td><span class="muted">Chưa đủ dữ liệu</span></td><td>${esc(r.readinessLabel)}</td><td>Không dùng để đề xuất QC</td></tr>`;
    if(r.sigma<govSigma)govSigma=r.sigma;
    const run=r.run||{},spec=QCCore.westgardSigmaRules(r.sigma);return `<tr><td>Mức ${l}</td><td class="num" style="color:${r.c};font-weight:800">${fmt(r.sigma,2)}</td><td>${sgOpSpecCell(spec)}</td><td>${run.risk||'—'}</td><td>${run.plan||'Xây dựng theo SOP'}</td></tr>`;}).join('');
  const govSpec=Number.isFinite(govSigma)?QCCore.westgardSigmaRules(govSigma):null;
  /* Áp MỘT bộ quy tắc cho cả xét nghiệm nên phải theo mức yếu nhất (Sigma thấp nhất). */
  const govBlock=govSpec?`<div class="alert ${govSpec.capable?(govSpec.single?'ok':'info'):'warn'}" style="display:block;margin-top:8px">Bộ quy tắc nên áp cho xét nghiệm — theo mức Sigma thấp nhất đủ điều kiện (${fmt(govSigma,2)}σ): ${govSpec.capable?`<b>${govSpec.rules.join(' / ')} · N=${govSpec.n}${govSpec.r>1?' · R='+govSpec.r:''}</b>. `:''}${govSpec.single?'Sigma cao → chỉ cần 1 quy tắc <b>1-3s</b>, giảm báo động giả không cần thiết.':govSpec.marginal?'Hiệu năng cận biên (3–4σ): dùng bộ đa quy tắc tối đa và <b>ưu tiên cải thiện phương pháp</b>.':govSpec.capable?'Dùng bộ đa quy tắc theo Sigma đo được.':'Phương pháp <b>&lt;3σ</b>: QC không bù được sai số — phải khắc phục phương pháp trước khi tin cậy kết quả.'}</div>`:'';
  return `${periodHint}<table><thead><tr><th>Mức</th><th class="num">Sigma</th><th>Bộ quy tắc QC gợi ý (OPSpecs)</th><th>Mức nguy cơ tham khảo</th><th>Hành động</th></tr></thead><tbody>${rows}</tbody></table>${govBlock}
    <div class="alert info" style="display:block;margin-top:8px">Gợi ý theo <b>Westgard Sigma Rules</b> chỉ là điểm khởi đầu. Phần mềm <b>không tự đổi</b> bộ quy tắc của xét nghiệm — người phụ trách rà soát rồi tự cấu hình trong Cài đặt Westgard theo đánh giá nguy cơ, độ ổn định hệ thống, khối lượng mẫu và hậu quả lâm sàng.</div>`;
}
const SG_MU_MODEL_NOTE='Mô hình <b>top-down</b> (ISO/TS 20914 · Nordtest TR 537): <b>u(Rw)</b> là CV% dài hạn của IQC (cùng cohort một lô đang dùng cho Sigma), <b>u(bias)</b> = √(Bias² + u(Cref)²) từ các vòng EQA/EQC, <b>u(cal)</b> chép từ CoA của calibrator. u<sub>c</sub> = √(Σu²) và <b>U = 2·u<sub>c</sub></b> (xấp xỉ 95%).';
const SG_MU_COMPONENT_LABELS={uRw:'u(Rw)',uBias:'u(bias)',uCal:'u(cal)'};
/* Thành phần chiếm phần lớn PHƯƠNG SAI mới là thứ đáng đi sửa trước: u_c cộng bậc
   hai nên một thành phần gấp đôi thành phần kia đã chiếm ~80% ngân sách. Chỉ nêu
   khi nó thực sự trội (>50%), tránh gợi ý sai khi ba thành phần xấp xỉ nhau. */
function sgMuDominant(mu){
  const entries=Object.entries((mu&&mu.shares)||{}).filter(([,v])=>Number.isFinite(v));
  if(entries.length<2)return'';
  const top=entries.sort((a,b)=>b[1]-a[1])[0];
  return top[1]>.5?`${SG_MU_COMPONENT_LABELS[top[0]]||top[0]} chiếm ${fmt(top[1]*100,0)}%`:'';
}
function sgMuStateChip(mu){
  if(!mu)return '<span class="tag none">Chưa có CV IQC</span>';
  if(!mu.complete)return `<span class="tag warn">Thiếu ${esc(mu.missing.join(', '))}</span>`;
  return '<span class="tag ok">Đủ thành phần</span>';
}
/* Không tự chấm đạt/không đạt: giới hạn MU cho phép (MAU) phải do SOP của đơn vị
   ấn định. Phần mềm chỉ đặt U cạnh TEa để thấy tỉ lệ, và tô đỏ khi U đã vượt TEa
   — lúc đó khoảng 95% của phép đo đã rộng hơn sai số tổng cho phép, là điều không
   cần SOP nào cũng thấy được là bất thường. */
function sgMuHTML(t,row,levels){
  if(!row)return '<div class="hint">Chưa có kỳ Sigma nào để lập ngân sách độ không đảm bảo đo.</div>';
  const unit=t.unit||'',e=row.e,trace=[];
  const cells=levels.map((l,i)=>{
    const r=row.rs[i],mu=(r&&r.mu)||sgMU(t,e,l),L=(e.lv&&e.lv[l])||{};
    if(L.uCalBasis)trace.push(`Mức ${l} · nguồn u(cal): ${esc(L.uCalBasis)}`);
    if(!mu)return `<tr><td><b>Mức ${l}</b></td><td colspan="8" class="muted">Chưa có CV IQC — chưa tính được MU</td></tr>`;
    const uBias=!mu.includeBias?'<span class="muted">không cộng</span>':mu.uBias==null?'<span class="muted">chưa có Bias</span>':fmt(mu.uBias,2)+(mu.biasRefU!=null?`<div class="sg-cell-meta">gồm u(Cref) ${fmt(mu.biasRefU,2)}</div>`:'');
    const uCal=mu.uCal==null?'<span class="muted">chưa nhập CoA</span>':fmt(mu.uCal,2);
    const abs=mu.absoluteU==null?'<span class="muted">chưa có Mean</span>':fmt(mu.absoluteU,3)+(unit?' '+esc(unit):'');
    const ratio=mu.teaRatio==null?'<span class="muted">—</span>':`<b style="color:${mu.withinTea?'var(--teal)':'var(--red)'}">${fmt(mu.teaRatio*100,0)}%</b>`;
    const dominant=sgMuDominant(mu);
    return `<tr><td><b>Mức ${l}</b></td><td class="num">${fmt(mu.uRw,2)}</td><td class="num">${uBias}</td><td class="num">${uCal}</td><td class="num">${fmt(mu.uc,2)}${dominant?`<div class="sg-cell-meta">${esc(dominant)}</div>`:''}</td><td class="num"><b>${fmt(mu.U,2)}</b></td><td class="num">${abs}</td><td class="num">${ratio}</td><td>${sgMuStateChip(mu)}</td></tr>`;
  }).join('');
  const reviewer=levels.map(l=>(e.lv&&e.lv[l])||{}).find(L=>L.muReviewedBy||L.muReviewedDate);
  if(reviewer)trace.push(`Người rà soát: ${esc(reviewer.muReviewedBy||'—')}${reviewer.muReviewedDate?' · '+vnDate(reviewer.muReviewedDate):''}`);
  const excluded=levels.filter(l=>sgMuBiasMode((e.lv&&e.lv[l])||{})==='exclude');
  const exclNote=excluded.length?`<div class="alert warn" style="display:block;margin-top:8px">Mức ${excluded.join(', ')} đang <b>không cộng u(bias)</b> vào ngân sách. ISO/TS 20914 chỉ chấp nhận điều này khi độ chệch đã được điều tra và hiệu chỉnh — hãy lưu bằng chứng hiệu chỉnh trong SOP/hồ sơ tương ứng.</div>`:'';
  return `<div class="hint sg-selected-period-hint">Kỳ đang xem: <b>${esc(vnPeriod(e.period)||e.period||'?')}</b></div>
    <div class="sg-mu-table-wrap"><table class="sg-mu-summary-table"><colgroup><col><col><col><col><col><col><col><col><col></colgroup><thead><tr><th>Mức</th><th class="num">u(Rw) %</th><th class="num">u(bias) %</th><th class="num">u(cal) %</th><th class="num">u<sub>c</sub> %</th><th class="num">U (k=2) %</th><th class="num">U tại Mean</th><th class="num">U / TEa</th><th>Trạng thái</th></tr></thead><tbody>${cells}</tbody></table></div>
    ${trace.length?`<div class="hint" style="margin-top:6px">${trace.join('<br>')}</div>`:''}
    ${exclNote}
    <div class="alert info" style="display:block;margin-top:8px">${SG_MU_MODEL_NOTE} Giới hạn MU cho phép (MAU) <b>phải do SOP của đơn vị ấn định</b> — phần mềm chỉ đặt U cạnh TEa để so sánh, không tự kết luận đạt/không đạt. Ngân sách còn thiếu thành phần thì <b>không được công bố</b> như một giá trị MU hoàn chỉnh.</div>`;
}
function sgRefresh(){
  const t=state.tests.find(x=>x.id===sgTest);if(!t)return;const data=sgData(t.id);const levels=sgVisibleLevels(t);
  const cached=sgPendingRows&&sgPendingRows.tid===t.id&&sgPendingRows.data===data?sgPendingRows.rows:null;sgPendingRows=null;
  const rows=cached||sgRows(t,data,levels);
  rows.forEach(row=>levels.forEach((l,i)=>{const cell=document.getElementById('sg_'+row.e.id+'_'+l);if(!cell)return;const r=row.rs[i],meta=cell.parentElement&&cell.parentElement.querySelector('.sg-cell-meta');
    if(!r){cell.textContent='—';cell.style.color='var(--muted)';cell.style.removeProperty('--sg-color');if(meta)meta.style.color='var(--muted)';}else{cell.textContent=(r.classifiable?'':'≈')+fmt(r.sigma,2);cell.style.color=r.c;cell.style.setProperty('--sg-color',r.c);if(meta)meta.style.color=r.c;cell.style.fontWeight='700';cell.title=r.classifiable?r.biasLabel+' '+fmt(r.bias,2)+'% · DPMO '+sgFmtDPMO(r.dpmo)+' · Yield '+fmt(r.yld,4)+'% · ΔSE_crit '+fmt(r.dse,2):r.readinessLabel;}}));
  const classifiable=rows.filter(x=>x.rs.some(r=>r&&r.classifiable)),selectedId=sgStatusPeriodId(t.id,data),selectedRow=rows.find(x=>x.e.id===selectedId)||rows[rows.length-1];
  const stt=document.getElementById('sgStatus');
  if(stt){if(!selectedRow)stt.innerHTML=sgTea(t)?'<div class="hint">Chưa có kỳ Sigma. Hãy thêm kỳ để bắt đầu.</div>':'<div class="alert warn">Chưa có TEa% hợp lệ cho nguồn đang chọn. Hãy chọn nguồn TEa khác có giá trị tham chiếu.</div>';
    else{const last=selectedRow;
      const card=(l,r)=>{if(!r)return `<div class="sgbig" style="background:var(--muted)"><div class="lab">Mức ${l}</div><div class="v">—</div><div class="sub">Chưa nhập CV hoặc Bias được chọn</div></div>`;
        const run=r.run;return `<div class="sgbig" style="background:${r.c}"><div class="lab">Mức ${l} — ${r.classifiable?'Sigma':'Sigma tạm tính'}</div><div class="v">${fmt(r.sigma,2)}</div><div class="grade">${r.label}</div><div class="sub">CV IQC ${fmt(r.cv,2)}% · ${r.biasLabel} ${fmt(r.bias,2)}%<br>${r.classifiable?'DPMO '+sgFmtDPMO(r.dpmo)+' · Yield '+fmt(r.yld,4)+'%':esc(r.readinessLabel)}<br>${run?run.risk+' · '+run.plan:''}</div></div>`;};
      const lastTea=(last.rs.find(Boolean)||{}).tea||sgEntryTea(t,last.e,levels[0])||sgTea(t);let html=`<div class="hint" style="margin-bottom:8px">Kỳ đang xem: <b>${vnPeriod(last.e.period)||'?'}</b> · ${esc(testDisplayName(t))} · TEa ${lastTea||'—'}%</div><div class="sgcards">`;
      levels.forEach((l,i)=>html+=card(l,last.rs[i]));html+='</div>';
      levels.forEach((l,i)=>html+=sgTips(t,last.rs[i],l));
      stt.innerHTML=html;}}
  const tr=document.getElementById('sgTrend');if(tr)tr.innerHTML=sgTrendSVG(t,classifiable,levels);
  const md=document.getElementById('sgMDC');if(md)md.innerHTML=sgMDCSVG(t,classifiable,levels);
  const fq=document.getElementById('sgFreq');if(fq)fq.innerHTML=sgFrequencyHTML(t,selectedRow,levels);
  const muAction=document.getElementById('sgMUAction');if(muAction)muAction.innerHTML=selectedRow&&canWrite()?btn('Nhập u(Cal) từ CoA & rà soát MU',`sgOpenMU('${jsq(selectedRow.e.id)}')`,'teal sm','Nhập độ không đảm bảo của calibrator, chọn cách xử lý độ chệch và ghi người rà soát'):'';
  const muBox=document.getElementById('sgMU');if(muBox)muBox.innerHTML=sgMuHTML(t,selectedRow,levels);
}
function sgTips(t,r,lvl){
  if(!r||!r.classifiable||r.sigma>=4)return '';
  const tea=Number(r.tea)||sgTea(t),cv=+r.cv,b=Math.abs(r.bias),fail=r.sigma<3;
  const cvNeed=(tea-b)/4,biasNeed=tea-4*cv,share=b/(b+1.65*cv);
  const biasActs=['Hiệu chuẩn lại; kiểm tra lô/hạn dùng của calibrator.','Kiểm tra giá trị đích EQA (nhóm peer cùng phương pháp/máy).','Thử lô thuốc thử mới và chạy lại sau hiệu chuẩn.','Bảo trì/vệ sinh hệ quang, kiểm tra carryover và đường ống.'];
  const cvActs=['Bảo trì định kỳ thiết bị (đèn, bơm, hệ quang).','Kiểm tra lô thuốc thử & vật liệu QC (bảo quản, hạn dùng, độ đồng nhất).','Ổn định nhiệt độ phòng/điện áp; tránh rung động.','Chuẩn hóa thao tác (pipet, thời gian ủ); giảm khác biệt giữa người làm.'];
  let driver,acts;
  if(share>0.6){driver='chủ yếu do <b>độ chệch (bias) lớn</b>';acts=biasActs;}
  else if(share<0.4){driver='chủ yếu do <b>độ chụm (CV) lớn</b>';acts=cvActs;}
  else{driver='do <b>cả độ chệch lẫn độ chụm</b>';acts=[biasActs[0],cvActs[0],biasActs[1],cvActs[1]];}
  const tparts=[];if(cvNeed>0)tparts.push(`giảm CV ≤ <b>${fmt(cvNeed,2)}%</b> (hiện ${fmt(cv,2)}%)`);if(biasNeed>0)tparts.push(`giảm |Bias| ≤ <b>${fmt(biasNeed,2)}%</b> (hiện ${fmt(b,2)}%)`);
  const tgt=tparts.length?`Để đạt ≥ 4σ: ${tparts.join(' <i>hoặc</i> ')}.`:'Độ chệch đã vượt mức cho phép — phải giảm bias trước.';
  const head=fail?'Phương pháp <b>chưa đạt năng lực</b> — cần khắc phục trước khi tin cậy kết quả.':'Hiệu năng <b>cận biên</b> — nên cải thiện để vượt 4σ.';
  const extra=fail?'<li>Tạm thời tăng QC tối đa; nếu không cải thiện, cân nhắc đổi thuốc thử/phương pháp/thiết bị.</li>':'';
  return `<div class="alert" style="display:block;background:#f8fafb;border-left:3px solid ${r.c};color:var(--ink)"><b style="color:${r.c}">Khuyến nghị cải thiện — Mức ${lvl}</b><div style="margin:4px 0">${head} Nguyên nhân ${driver}.</div><div style="margin-bottom:4px">${tgt}</div><ul style="margin:4px 0 0 18px">${acts.map(a=>`<li>${a}</li>`).join('')}${extra}</ul></div>`;
}
/* Tooltip hover cho điểm trên biểu đồ SVG (Trend/MDC) — dùng chung #qcTooltip
   với Levey-Jennings (qcTooltip() ở draw.js) để đồng nhất giao diện, chỉ khác
   cách bind: canvas LJ phải tự dò khoảng cách chuột-điểm (không có DOM con để
   gắn sự kiện), còn điểm SVG là phần tử DOM thật nên gắn onmousemove/onmouseleave
   trực tiếp lên từng <circle> là đủ, khỏi cần dò khoảng cách thủ công. */
function sgPointTipShow(event,html){
  const tip=qcTooltip();tip.innerHTML=html;tip.style.display='block';
  const pad=12,tw=tip.offsetWidth||220,th=tip.offsetHeight||70;
  let left=event.clientX+14,top=event.clientY+14;
  if(left+tw+pad>innerWidth)left=event.clientX-tw-14;
  if(top+th+pad>innerHeight)top=event.clientY-th-14;
  tip.style.left=Math.max(pad,left)+'px';tip.style.top=Math.max(pad,top)+'px';
}
function sgPointTipHide(){const tip=document.getElementById('qcTooltip');if(tip)tip.style.display='none';}
function sgTrendSVG(t,valid,levels){
  const W=1000,H=245,L=42,R=16,T=23,B=34,maxS=8;
  const chartPad=34,px=i=>valid.length<=1?L+(W-L-R)/2:L+chartPad+i/(valid.length-1)*(W-L-R-chartPad*2);const py=s=>T+(maxS-s)/maxS*(H-T-B);
  let g='';const band=(s1,s2,c)=>`<rect x="${L}" y="${py(s2)}" width="${W-L-R}" height="${py(s1)-py(s2)}" fill="${c}"/>`;
  g+=`<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="#fff" stroke="#dce3e9"/>`;
  g+=band(6,8,'#edf5ef')+band(4,6,'#f6faf6')+band(3,4,'#fff6df')+band(0,3,'#fdebea');
  for(let s=0;s<=8;s+=2)g+=`<line x1="${L}" y1="${py(s)}" x2="${W-R}" y2="${py(s)}" stroke="#dde5e9" stroke-width=".7"/><text x="${L-7}" y="${py(s)+3}" font-size="10" fill="#70818d" text-anchor="end">${s}</text>`;
  g+=`<line x1="${L}" y1="${py(3)}" x2="${W-R}" y2="${py(3)}" stroke="#cf5a52" stroke-width=".85" stroke-dasharray="4 4"/><text x="${W-R-4}" y="${py(3)-4}" font-size="10" fill="#b83b33" text-anchor="end" font-weight="750">3σ</text>`;
  g+=`<line x1="${L}" y1="${py(6)}" x2="${W-R}" y2="${py(6)}" stroke="#2f7d5b" stroke-width=".85" stroke-dasharray="4 4"/><text x="${W-R-4}" y="${py(6)-4}" font-size="10" fill="#216b4a" text-anchor="end" font-weight="750">6σ</text>`;
  const cols=['#0e4d4a','#7a4f9a','#c47d12'];
  levels.forEach((l,li)=>{const col=cols[li%3];const pts=[];valid.forEach((v,i)=>{const r=v.rs[li];if(r&&isFinite(r.sigma))pts.push([px(i),py(Math.max(0,Math.min(8,r.sigma)))]);});
    if(pts.length>1)g+=`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    pts.forEach((p,pi)=>g+=`<circle cx="${p[0]}" cy="${p[1]}" r="${pi===pts.length-1?3.7:3}" fill="${col}" stroke="#fff" stroke-width="1.2"/>`);
    g+=`<rect x="${48+li*72}" y="9" width="12" height="3" rx="1.5" fill="${col}"/><text x="${65+li*72}" y="13" font-size="10" fill="${col}" font-weight="750">Mức ${l}</text>`;});
  valid.forEach((v,i)=>{if(valid.length<=6||i===0||i===valid.length-1)g+=`<text x="${px(i)}" y="${H-B+14}" font-size="10" fill="#70818d" text-anchor="middle">${(v.e.period||'').split('-').reverse().join('/')}</text>`;});
  g+=`<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#42515b" stroke-width=".9"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#42515b" stroke-width=".9"/>`;
  g+=`<text transform="translate(13,${(T+H-B)/2}) rotate(-90)" font-size="10" fill="#40515c" text-anchor="middle" font-weight="700">Sigma</text>`;
  return valid.length?`<div style="width:100%;margin:4px auto 0"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">${g}</svg></div>`:'<div class="hint">Chưa có dữ liệu.</div>';
}
function sgMDCSVG(t,valid,levels){
  const W=1000,H=275,L=45,R=16,T=23,B=42,xmax=60,ymax=100;
  const px=x=>L+x/xmax*(W-L-R),py=y=>H-B-y/ymax*(H-T-B);let g='';
  g+=`<rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}" fill="#fff" stroke="#dce3e9"/>`;
  for(let y=0;y<=100;y+=20)g+=`<line x1="${L}" y1="${py(y)}" x2="${W-R}" y2="${py(y)}" stroke="#e5ecef" stroke-width=".7"/><text x="${L-7}" y="${py(y)+3}" font-size="10" fill="#70818d" text-anchor="end">${y}</text>`;
  for(let x=0;x<=60;x+=10)g+=`<text x="${px(x)}" y="${H-B+15}" font-size="10" fill="#70818d" text-anchor="middle">${x}</text>`;
  /** @type {[number,string][]} */
  ([[2,'#c0362c'],[3,'#dd8b1f'],[4,'#b59a00'],[5,'#3f9a55'],[6,'#0e8f8f']]).forEach(([s,c])=>{const x2=Math.min(xmax,100/s),y2=100-s*x2,lx=px(x2)+3,ly=py(y2)-6;g+=`<line x1="${px(0)}" y1="${py(100)}" x2="${px(x2)}" y2="${py(y2)}" stroke="${c}" stroke-width="1" stroke-linecap="round" opacity=".88"/><text x="${lx}" y="${ly}" font-size="10" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round" font-weight="800">${s}σ</text><text x="${lx}" y="${ly}" font-size="10" fill="${c}" font-weight="800">${s}σ</text>`;});
  const cols=['#0e4d4a','#7a4f9a','#c47d12'];
  levels.forEach((l,li)=>{const col=cols[li%3],pts=[];valid.forEach((v,i)=>{const r=v.rs[li];if(!r)return;const tea=Number(r.tea)||sgTea(t)||1,X=r.cv/tea*100,Y=Math.abs(r.bias)/tea*100;pts.push({x:px(Math.min(xmax,X)),y:py(Math.min(ymax,Y)),i,r,X,Y,period:v.e.period});});
    if(pts.length>1)g+=`<polyline points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="${col}" stroke-opacity=".3" stroke-width=".9" stroke-dasharray="3 3"/>`;
    pts.forEach(p=>{const big=p.i===valid.length-1,r=p.r,periodLabel=esc(vnPeriod(p.period)||p.period||'?'),sigmaTxt=r.classifiable?fmt(r.sigma,2):'≈'+fmt(r.sigma,2);
      /* Nội dung tip nằm bên trong attribute onmousemove="..." (nháy kép) — mọi thuộc
         tính HTML BÊN TRONG tip phải dùng nháy đơn, nếu không dấu nháy kép sẽ tự
         "cắt đứt" attribute onmousemove giữa chừng (jsq() chỉ escape nháy đơn/</>/&,
         không escape nháy kép, vì nó được thiết kế để nhúng trong CHUỖI JS nháy đơn). */
      const tip=`<b>${periodLabel} · Mức ${l}</b><div>Sigma: <b style='color:${r.c}'>${sigmaTxt}</b> · ${esc(r.label)}</div><div>CV/TEa: ${fmt(p.X,1)}% · |Bias|/TEa: ${fmt(p.Y,1)}%</div><div class='muted'>CV ${fmt(r.cv,2)}% · Bias ${fmt(r.bias,2)}%</div>`;
      g+=`<circle cx="${p.x}" cy="${p.y}" r="${big?4.8:3.2}" fill="${col}" fill-opacity="${big?0.95:0.62}" stroke="#fff" stroke-width="1.2" style="cursor:pointer" onmousemove="sgPointTipShow(event,'${jsq(tip)}')" onmouseleave="sgPointTipHide()"/>`;});
    g+=`<rect x="${50+li*72}" y="9" width="12" height="3" rx="1.5" fill="${col}"/><text x="${67+li*72}" y="13" font-size="10" fill="${col}" font-weight="750">Mức ${l}</text>`;});
  g+=`<line x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}" stroke="#42515b" stroke-width=".9"/><line x1="${L}" y1="${T}" x2="${L}" y2="${H-B}" stroke="#42515b" stroke-width=".9"/>`;
  g+=`<text x="${(L+W-R)/2}" y="${H-7}" font-size="10" fill="#40515c" text-anchor="middle" font-weight="750">CV / TEA (%)</text>`;
  g+=`<text transform="translate(13,${(T+H-B)/2}) rotate(-90)" font-size="10" fill="#40515c" text-anchor="middle" font-weight="750">|BIAS| / TEA (%)</text>`;
  return valid.length?`<div style="width:100%;margin:4px auto 0"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">${g}</svg></div>`:'<div class="hint">Chưa có dữ liệu.</div>';
}
function sgBiasRowsFromDom(){return [...document.querySelectorAll('.sg-eqa-row')].map(r=>({lab:r.querySelector('[data-f="lab"]').value,target:r.querySelector('[data-f="target"]').value}));}
function sgBiasPeriodsFromDom(){const boxes=[...document.querySelectorAll('[data-sg-bias-period]')];return boxes.length?boxes.filter(x=>x.checked).map(x=>x.value):(sgBiasCtx&&sgBiasCtx.periodIds||[]);}
/* RMS chỉ có tác dụng chống triệt tiêu dấu khi có ≥2 vòng; với đúng 1 vòng thì
   không có gì để triệt tiêu — dùng signedMean (cùng độ lớn, giữ đúng chiều lệch)
   thay vì sqrt(bias²) làm mất dấu một cách không cần thiết. */
function sgBiasStats(rounds){const valid=(rounds||[]).map(r=>{const lab=parseFloat(r.lab),target=parseFloat(r.target);return isFinite(lab)&&isFinite(target)&&target!==0?{lab,target,bias:(lab-target)/Math.abs(target)*100}:null;}).filter(Boolean);if(!valid.length)return{valid:[],signedMean:null,rms:null};const signedMean=valid.reduce((s,r)=>s+r.bias,0)/valid.length,rms=valid.length===1?valid[0].bias:Math.sqrt(valid.reduce((s,r)=>s+r.bias*r.bias,0)/valid.length);return{valid,signedMean,rms};}
function sgBiasRoundsKey(rounds){return JSON.stringify((rounds||[]).map(r=>({lab:Number(r.lab),target:Number(r.target)})).filter(r=>Number.isFinite(r.lab)&&Number.isFinite(r.target)&&r.target!==0));}
function sgBiasLinkedPeriodIds(data,eid,level){
  const source=(data||[]).find(e=>e.id===eid),L=source&&source.lv&&source.lv[level];if(!L)return[eid];
  if(L.eqaBatchId)return(data||[]).filter(e=>e.lv&&e.lv[level]&&e.lv[level].eqaBatchId===L.eqaBatchId).map(e=>e.id);
  const key=L.biasEqaMethod==='rms'?sgBiasRoundsKey(L.eqaRounds):'';if(!key||key==='[]')return[eid];
  const linked=(data||[]).filter(e=>{const x=e.lv&&e.lv[level];return x&&x.biasEqaMethod==='rms'&&sgBiasRoundsKey(x.eqaRounds)===key&&Number(x.biasEqa)===Number(L.biasEqa);}).map(e=>e.id);
  return linked.length?linked:[eid];
}
function sgOpenBias(eid,level){
  const data=sgData(sgTest),e=data.find(x=>x.id===eid);if(!e)return;e.lv=e.lv||{};e.lv[level]=e.lv[level]||{};
  const saved=e.lv[level].eqaRounds,rounds=(Array.isArray(saved)&&saved.length?saved:[]).map(r=>({...r}));while(rounds.length<3)rounds.push({lab:'',target:''});sgBiasCtx={eid,level,periodIds:sgBiasLinkedPeriodIds(data,eid,level),rounds};
  sgRenderBiasModal();
}
function sgRenderBiasModal(){
  const c=sgBiasCtx;if(!c)return;const rounds=c.rounds.length?c.rounds:[{lab:'',target:''}],periods=[...sgData(sgTest)].sort((a,b)=>String(a.period||'').localeCompare(String(b.period||'')));
  const rows=rounds.map((r,i)=>{const lab=parseFloat(r.lab),target=parseFloat(r.target),bias=(isFinite(lab)&&isFinite(target)&&target!==0)?(lab-target)/Math.abs(target)*100:null;
    return `<tr class="sg-eqa-row"><td class="sg-eqa-index">${i+1}</td><td><input type="number" step="any" data-f="lab" value="${escAttr(r.lab??'')}" placeholder="—" oninput="sgBiasUpdateSummary()"></td><td><input type="number" step="any" data-f="target" value="${escAttr(r.target??'')}" placeholder="—" oninput="sgBiasUpdateSummary()"></td><td class="sg-eqa-bias" data-bias>${bias==null?'—':fmt(bias,2)+'%'}</td><td>${btn('Xóa',`sgBiasDel(${i})`,'danger sm sg-eqa-del','Xóa vòng')}</td></tr>`;}).join('');
  const periodRows=periods.map(e=>`<label class="sg-eqa-period"><input type="checkbox" data-sg-bias-period value="${escAttr(e.id)}" ${(c.periodIds||[]).includes(e.id)?'checked':''}><span>${esc(vnPeriod(e.period)||'Chưa chọn kỳ')}</span></label>`).join('');
  openModal(`<div class="modal sg-eqa-modal"><div class="modal-h"><h3>Tính Bias% từ EQA/EQC — Mức ${c.level}</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><div class="sg-eqa-table-wrap"><table class="sg-eqa-table"><thead><tr><th>#</th><th>KQ PXN</th><th>Target EQA</th><th>Bias%</th><th><span style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Thao tác</span></th></tr></thead><tbody>${rows}</tbody></table></div>
      ${btn('+ Thêm vòng','sgBiasAdd()','ghost sm sg-eqa-add')}<div id="sgBiasSummary" class="sg-eqa-summary alert info"></div>
      <div class="sg-eqa-period-wrap"><div class="sg-eqa-period-head"><b>Áp dụng cho kỳ nào?</b><div>${btn('Chọn tất cả','sgBiasSelectPeriods(true)','ghost sm')}${btn('Bỏ chọn','sgBiasSelectPeriods(false)','ghost sm')}</div></div><div class="sg-eqa-period-list">${periodRows}</div></div></div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('✓ Áp dụng Bias%','sgBiasApply()','teal')}</div></div>`);
  sgBiasUpdateSummary();
}
function sgBiasUpdateSummary(){
  if(!sgBiasCtx)return;const rounds=sgBiasRowsFromDom();sgBiasCtx.rounds=rounds;const stats=sgBiasStats(rounds);
  document.querySelectorAll('[data-bias]').forEach((el,i)=>{const r=rounds[i],lab=parseFloat(r.lab),target=parseFloat(r.target),b=(isFinite(lab)&&isFinite(target)&&target!==0)?(lab-target)/Math.abs(target)*100:null;el.textContent=b==null?'—':fmt(b,2)+'%';el.style.color=b!=null&&Math.abs(b)>10?'var(--red)':'var(--teal)';});
  const el=document.getElementById('sgBiasSummary');if(!el)return;if(!stats.valid.length){el.classList.add('is-empty');el.innerHTML='<span class="sg-eqa-empty">Chưa có vòng hợp lệ.</span>';return;}
  el.classList.remove('is-empty');const mixed=stats.valid.some(r=>r.bias<0)&&stats.valid.some(r=>r.bias>0),note=mixed?'<div class="sg-eqa-warning">Bias đổi dấu giữa các vòng — RMS giúp tránh triệt tiêu.</div>':'';el.innerHTML=`<div><span>Số vòng hợp lệ</span><b>${stats.valid.length}</b></div><div><span>Bias có dấu TB</span><b>${fmt(stats.signedMean,2)}%</b></div><div><span>Bias RMS dùng tính Sigma</span><b class="sg-eqa-average">${fmt(stats.rms,2)}%</b></div>${note}`;
}
function sgBiasSelectPeriods(checked){document.querySelectorAll('[data-sg-bias-period]').forEach(x=>x.checked=checked);if(sgBiasCtx)sgBiasCtx.periodIds=sgBiasPeriodsFromDom();}
function sgBiasAdd(){if(!sgBiasCtx)return;sgBiasCtx.periodIds=sgBiasPeriodsFromDom();sgBiasCtx.rounds=sgBiasRowsFromDom();sgBiasCtx.rounds.push({lab:'',target:''});sgRenderBiasModal();}
function sgBiasDel(i){if(!sgBiasCtx)return;sgBiasCtx.periodIds=sgBiasPeriodsFromDom();sgBiasCtx.rounds=sgBiasRowsFromDom();sgBiasCtx.rounds.splice(i,1);if(!sgBiasCtx.rounds.length)sgBiasCtx.rounds.push({lab:'',target:''});sgRenderBiasModal();}
function sgApplyBiasToPeriods(data,periodIds,level,bias,rounds,batchId=uid()){let applied=0;(data||[]).forEach(e=>{if(!(periodIds||[]).includes(e.id))return;e.lv=e.lv||{};const L=e.lv[level]=e.lv[level]||{};L.biasEqa=Number(bias);L.biasEqaMethod='rms';L.eqaRounds=(rounds||[]).map(r=>({lab:r.lab,target:r.target}));L.eqaBatchId=batchId;applied++;});return applied;}
async function sgBiasApply(){
  if(!requireWrite())return;
  if(!sgBiasCtx)return;sgBiasCtx.rounds=sgBiasRowsFromDom();const stats=sgBiasStats(sgBiasCtx.rounds);if(!stats.valid.length){await infoDialog('Chưa có vòng hợp lệ để tính Bias.');return;}
  sgBiasCtx.periodIds=sgBiasPeriodsFromDom();if(!sgBiasCtx.periodIds.length){await infoDialog('Chưa chọn kỳ nào để áp dụng Bias.');return;}
  const validRounds=stats.valid.map(r=>({lab:r.lab,target:r.target})),applied=sgApplyBiasToPeriods(sgData(sgTest),sgBiasCtx.periodIds,sgBiasCtx.level,stats.rms,validRounds);if(!applied)return;save({clearDerived:false,sigmaTestId:sgTest});closeModal();rerender();
}
/* Modal MU sửa MỘT LẦN mọi mức của kỳ đang xem rồi áp cho nhiều kỳ, giống modal
   Bias: u(cal) là thuộc tính của LÔ CALIBRATOR chứ không của tháng, nên bắt nhập
   lại từng kỳ chỉ tạo cơ hội gõ lệch nhau giữa các kỳ dùng chung một CoA. */
function sgMuRowsFromDom(){
  return [...document.querySelectorAll('.sg-mu-row')].map(tr=>({level:Number(tr.dataset.level),uCal:tr.querySelector('[data-f="uCal"]').value,uCalBasis:tr.querySelector('[data-f="uCalBasis"]').value,muBiasMode:tr.querySelector('[data-f="muBiasMode"]').value}));
}
function sgMuPeriodsFromDom(){const boxes=[...document.querySelectorAll('[data-sg-mu-period]')];return boxes.length?boxes.filter(x=>x.checked).map(x=>x.value):(sgMuCtx&&sgMuCtx.periodIds||[]);}
function sgMuCaptureDom(){
  if(!sgMuCtx)return;
  if(document.querySelector('.sg-mu-row'))sgMuCtx.rows=sgMuRowsFromDom();
  sgMuCtx.periodIds=sgMuPeriodsFromDom();
  const by=document.getElementById('sgMuBy'),dt=document.getElementById('sgMuDate');
  if(by)sgMuCtx.reviewedBy=by.value;if(dt)sgMuCtx.reviewedDate=dt.value;
}
/* Xem trước dùng ĐÚNG QCCore.uncertaintyBudget() như bảng ngoài trang, chỉ thay
   u(cal)/chế độ bias bằng thứ đang gõ dở — nếu tự nhân chia lại ở đây thì con số
   trong modal và con số sau khi bấm "Áp dụng" có thể lệch nhau mà không ai biết. */
function sgMuPreview(level){
  if(!sgMuCtx)return null;
  const t=state.tests.find(x=>x.id===sgTest),e=sgData(sgTest).find(x=>x.id===sgMuCtx.eid);if(!t||!e)return null;
  const row=(sgMuCtx.rows||[]).find(r=>r.level===level)||{},L=(e.lv&&e.lv[level])||{};
  return QCCore.uncertaintyBudget({cv:L.cv,bias:sgBiasVal(L),biasRefU:sgBiasRefU(L.eqaRounds),uCal:row.uCal,includeBias:row.muBiasMode!=='exclude',tea:sgEntryTea(t,e,level),target:sgLevelTarget(t,L,level),k:2});
}
function sgMuUpdatePreview(){
  sgMuCaptureDom();
  document.querySelectorAll('[data-sg-mu-preview]').forEach(cell=>{
    const mu=sgMuPreview(Number(cell.dataset.sgMuPreview));
    cell.innerHTML=mu?`<div class="sg-mu-preview-values"><span><small>u<sub>c</sub></small><b>${fmt(mu.uc,2)}%</b></span><span class="is-u"><small>U (k=2)</small><b>${fmt(mu.U,2)}%</b></span></div><div class="sg-mu-preview-state ${mu.complete?'ok':'warn'}">${mu.complete?'Đủ thành phần':'Thiếu '+esc(mu.missing.join(', '))}</div>`:'<div class="sg-mu-preview-empty">Chưa có CV IQC</div>';
  });
}
function sgOpenMU(eid){
  if(!requireWrite())return;
  const t=state.tests.find(x=>x.id===sgTest),e=sgData(sgTest).find(x=>x.id===eid);if(!t||!e)return;
  e.lv=e.lv||{};
  const levels=sgVisibleLevels(t),signed=levels.map(l=>e.lv[l]||{}).find(L=>L.muReviewedBy||L.muReviewedDate)||{};
  sgMuCtx={eid,levels,periodIds:[eid],
    rows:levels.map(l=>{const L=e.lv[l]||{};return{level:l,uCal:L.uCal??'',uCalBasis:L.uCalBasis||'',muBiasMode:sgMuBiasMode(L)};}),
    reviewedBy:signed.muReviewedBy||userName(),reviewedDate:vnDate(signed.muReviewedDate||isoDate())};
  sgRenderMuModal();
}
function sgRenderMuModal(){
  const c=sgMuCtx;if(!c)return;
  const periods=[...sgData(sgTest)].sort((a,b)=>String(a.period||'').localeCompare(String(b.period||'')));
  const sourcePeriod=periods.find(e=>e.id===c.eid),sourceLabel=sourcePeriod?(vnPeriod(sourcePeriod.period)||sourcePeriod.period||'—'):'—';
  const rows=c.rows.map(r=>`<tr class="sg-mu-row" data-level="${r.level}"><td><b>Mức ${r.level}</b></td>
    <td><div class="sg-mu-number-field"><input type="number" step="any" min="0" data-f="uCal" aria-label="u(cal) phần trăm cho mức ${r.level}" value="${escAttr(r.uCal??'')}" placeholder="0,00" oninput="sgMuUpdatePreview()"><span aria-hidden="true">%</span></div></td>
    <td><input type="text" data-f="uCalBasis" aria-label="Nguồn CoA của u(cal) cho mức ${r.level}" value="${escAttr(r.uCalBasis||'')}" placeholder="VD: CoA lô 1234, mục U(k=2)" oninput="sgMuUpdatePreview()"></td>
    <td><select data-f="muBiasMode" aria-label="Cách xử lý độ chệch cho mức ${r.level}" onchange="sgMuUpdatePreview()"><option value="include" ${r.muBiasMode!=='exclude'?'selected':''}>Cộng u(bias)</option><option value="exclude" ${r.muBiasMode==='exclude'?'selected':''}>Đã hiệu chỉnh — không cộng</option></select></td>
    <td class="sg-mu-preview" data-sg-mu-preview="${r.level}"></td></tr>`).join('');
  const periodRows=periods.map(e=>`<label class="sg-eqa-period"><input type="checkbox" data-sg-mu-period value="${escAttr(e.id)}" ${(c.periodIds||[]).includes(e.id)?'checked':''}><span>${esc(vnPeriod(e.period)||'Chưa chọn kỳ')}</span></label>`).join('');
  openModal(`<div class="modal sg-eqa-modal sg-mu-modal"><div class="modal-h"><h3>Ngân sách độ không đảm bảo đo (MU)</h3><button class="modal-close" onclick="closeModal()" aria-label="Đóng">✕</button></div>
    <div class="modal-b"><div class="sg-mu-intro"><div><b>Nhập thông tin theo từng mức QC</b><span>u(cal) lấy từ chứng nhận CoA của calibrator.</span></div><span class="tag none">Kỳ gốc: ${esc(sourceLabel)}</span></div>
      <div class="sg-eqa-table-wrap"><table class="sg-eqa-table sg-mu-table"><thead><tr><th>Mức QC</th><th>u(cal) từ CoA</th><th>Nguồn / mã CoA</th><th>Xử lý u(bias)</th><th>MU dự kiến</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="alert info" style="display:block">${SG_MU_MODEL_NOTE}</div>
      <div class="sg-mu-section-title"><b>Thông tin rà soát</b><span>Ghi nhận người chịu trách nhiệm xác nhận ngân sách MU.</span></div>
      <div class="sg-setup-fields">
        <div><label for="sgMuBy">Người rà soát</label><input id="sgMuBy" value="${escAttr(c.reviewedBy||'')}" placeholder="Họ tên người rà soát ngân sách MU"></div>
        <div><label for="sgMuDate">Ngày rà soát</label>${dateBox('sgMuDate',c.reviewedDate||'','manage-date')}</div>
      </div>
      <div class="sg-eqa-period-wrap sg-mu-period-wrap"><div class="sg-eqa-period-head"><div><b>Kỳ áp dụng</b><span>Chọn các kỳ dùng cùng calibrator và nguồn CoA.</span></div><div>${btn('Chọn tất cả','sgMuSelectPeriods(true)','ghost sm')}${btn('Bỏ chọn','sgMuSelectPeriods(false)','ghost sm')}</div></div><div class="sg-eqa-period-list">${periodRows}</div></div></div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('✓ Áp dụng ngân sách MU','sgMuApply()','teal')}</div></div>`);
  sgMuUpdatePreview();
}
function sgMuSelectPeriods(checked){document.querySelectorAll('[data-sg-mu-period]').forEach(x=>x.checked=checked);sgMuCaptureDom();}
async function sgMuApply(){
  if(!requireWrite())return;
  if(!sgMuCtx)return;
  sgMuCaptureDom();
  if(!sgMuCtx.periodIds.length){await infoDialog('Chưa chọn kỳ nào để áp dụng ngân sách MU.');return;}
  const t=state.tests.find(x=>x.id===sgTest);if(!t)return;
  const data=sgData(sgTest),by=QCCore.cleanText(sgMuCtx.reviewedBy,120),date=parseVN(sgMuCtx.reviewedDate)||'';
  let applied=0;
  data.forEach(e=>{
    if(!sgMuCtx.periodIds.includes(e.id))return;
    e.lv=e.lv||{};
    sgMuCtx.rows.forEach(row=>{
      const L=e.lv[row.level]=e.lv[row.level]||{},raw=String(row.uCal??'').trim(),n=Number(raw);
      if(raw!==''&&Number.isFinite(n)&&n>=0)L.uCal=n;else delete L.uCal;
      const basis=QCCore.cleanText(row.uCalBasis,500);if(basis)L.uCalBasis=basis;else delete L.uCalBasis;
      L.muBiasMode=row.muBiasMode==='exclude'?'exclude':'include';
      if(by)L.muReviewedBy=by;else delete L.muReviewedBy;
      if(date)L.muReviewedDate=date;else delete L.muReviewedDate;
    });
    applied++;
  });
  if(!applied)return;
  logAct('Cập nhật ngân sách MU',`${applied} kỳ · ${sgMuCtx.rows.length} mức · u(cal) ${sgMuCtx.rows.map(r=>`M${r.level}=${String(r.uCal??'').trim()||'—'}`).join(', ')}`,testDisplayName(t));
  save({clearDerived:false,sigmaTestId:sgTest});closeModal();rerender();
}
function sgCell(eid,level,field,val){if(!requireWrite())return;const t=state.tests.find(x=>x.id===sgTest),e=sgData(sgTest).find(x=>x.id===eid);if(!e||!t)return;sgEnsureTeaSnapshot(t,e);e.lv=e.lv||{};const L=e.lv[level]=e.lv[level]||{};L[field]=sgCleanCell(field,val);if(field==='biasEqa'){if(L.biasEqa==='')delete L.biasEqaMethod;else L.biasEqaMethod='manual';delete L.eqaRounds;delete L.eqaBatchId;}if(field==='cv'){L.cvSource='manual';['n','sourceStart','sourceEnd','sourceLot','cohortStatus','cohortIssues','sourceExcludedVoided','sourceExcludedInvalid','sourceTargetMean','sourceTargetSd'].forEach(k=>delete L[k]);}sgSetLevelTeaSnapshot(t,e,level);save({clearDerived:false,sigmaTestId:sgTest});sgRefreshSoon();}
function sgPeriodSel(e,ro){const [y,mo]=(e.period||'').split('-'),nowYear=new Date().getFullYear();const yr=y||String(nowYear),mm=mo?+mo:new Date().getMonth()+1;
  const mOpt=Array.from({length:12},(_,i)=>i+1).map(x=>`<option value="${x}" ${x===mm?'selected':''}>${String(x).padStart(2,'0')}</option>`).join('');
  const selectedYear=parseInt(yr)||nowYear,minYear=Math.min(selectedYear,nowYear-4),maxYear=Math.max(selectedYear,nowYear+2);
  let years=[];for(let yy=minYear;yy<=maxYear;yy++)years.push(yy);
  const yOpt=years.map(x=>`<option value="${x}" ${String(x)===yr?'selected':''}>${x}</option>`).join('');
  return `<div class="sg-period-controls"><select class="sg-period-month" aria-label="Tháng của kỳ" ${ro} onchange="sgPart('${e.id}','m',this.value)">${mOpt}</select><select class="sg-period-year" aria-label="Năm của kỳ" ${ro} onchange="sgPart('${e.id}','y',this.value)">${yOpt}</select></div>`;}
async function sgPart(eid,part,val){if(!requireWrite())return;const data=sgData(sgTest),e=data.find(x=>x.id===eid);if(!e)return;let [y,mo]=(e.period||isoMonth()).split('-');if(part==='y')y=val;else mo=String(val).padStart(2,'0');const next=y+'-'+mo;if(data.some(x=>x.id!==eid&&x.period===next)){await infoDialog('Đã có kỳ Sigma '+next+'. Mỗi xét nghiệm chỉ lưu một bản ghi cho mỗi kỳ.');rerender();return;}e.period=next;save({clearDerived:false,sigmaTestId:sgTest});sgRefreshSoon();}
async function sgAddPeriod(){if(!requireWrite())return;const t=state.tests.find(x=>x.id===sgTest),data=sgData(sgTest),period=isoMonth();if(!t)return;if(data.some(e=>e.period===period)){await infoDialog('Đã có kỳ Sigma '+period+'. Hãy cập nhật kỳ hiện có.');return;}const entry={id:uid(),period,...sgTeaSnapshot(t),lv:{}};data.push(entry);sgSelectedPeriods[sgTest]=entry.id;save({clearDerived:false,sigmaTestId:sgTest});rerender();}
function sgDelPeriod(eid){if(!requireAdmin())return;const d=sgData(sgTest);const i=d.findIndex(x=>x.id===eid);if(i>=0)d.splice(i,1);if(sgSelectedPeriods&&sgSelectedPeriods[sgTest]===eid)delete sgSelectedPeriods[sgTest];save({clearDerived:false,sigmaTestId:sgTest});rerender();}
function sgClearImportedCV(L){if(!sgIsAutoCV(L))return false;['cv','cvSource','n','sourceStart','sourceEnd','sourceLot','cohortStatus','cohortIssues','sourceExcludedVoided','sourceExcludedInvalid','sourceTargetMean','sourceTargetSd'].forEach(k=>delete L[k]);return true;}
function sgCohortCutoff(period){const ym=SigmaCohortService.normalizePeriod(period),today=isoToday();if(!ym)return'';const [y,m]=ym.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);return last<today?last:today;}
function sgCohortGroups(t,e){const cutoff=sgCohortCutoff(e.period),periodStart=e.period+'-01';return sgPeriodLevels(t,e).map(level=>{const raw=SigmaCohortService.cohortsForLevelByLot(state,{testId:t.id,level,endDate:cutoff}).filter(c=>c.n>0&&c.end>=periodStart),cohorts=raw.filter(c=>c.lot),missingLotN=raw.filter(c=>!c.lot).reduce((s,c)=>s+c.n,0),saved=e.lv&&e.lv[level]&&e.lv[level].sourceLot,latest=cohorts[cohorts.length-1],cfg=(t.levels||[]).find(l=>+l.level===+level);return{level,configuredLot:String(saved||latest&&latest.lot||cfg&&cfg.lot||''),cohorts,missingLotN};});}
function sgCohortStatusText(a){return a.status==='eligible'?'Đủ dữ liệu':a.status==='provisional'?'Tạm thời':a.status==='insufficient'?'Chưa đủ':'Không ổn định';}
/* force=true trên sgSetLevelTeaSnapshot chỉ dùng cho ĐÚNG kỳ hiện tại (isoMonth()),
   giống hệt quy tắc của sgSyncCurrentPeriodTea() — kỳ cũ chỉ được ĐIỀN TEa nếu
   chưa có (force=false), không bị kéo lại theo Bảng TEa tham chiếu hôm nay. Trước
   đây luôn force=true bất kể kỳ nào, nên bấm "CV lô" cho một kỳ cũ đã chốt TEa từ
   trước sẽ âm thầm đổi TEa của kỳ đó sang giá trị tham chiếu MỚI NHẤT — phá vỡ
   tính truy xuất lịch sử mà teaEffectiveDate/teaReviewedDate của kỳ đang ghi lại. */
function sgImportCohort(t,e,level,cohort){const st=cohort&&cohort.stats,existing=e.lv[level],forceTea=e.period===isoMonth();if(!(st&&st.n>=2&&st.cv>0)){const cleared=sgClearImportedCV(existing);if(cleared)sgSetLevelTeaSnapshot(t,e,level,forceTea);return{imported:false,cleared};}const L=e.lv[level]=existing||{},assessment=SigmaCohortService.assess(cohort);['sourceTargetMean','sourceTargetSd','cohortIssues','sourceExcludedVoided','sourceExcludedInvalid'].forEach(k=>delete L[k]);L.cv=st.cv;L.cvSource='iqc-cohort';L.n=st.n;L.sourceStart=cohort.start;L.sourceEnd=cohort.end;L.sourceLot=cohort.lot;L.cohortStatus=assessment.status;L.cohortIssues=cohort.issues;L.sourceExcludedVoided=cohort.excluded.voided;L.sourceExcludedInvalid=cohort.excluded.invalidValue;if(cohort.targetMean!=null&&cohort.targetMean!==0)L.sourceTargetMean=cohort.targetMean;if(cohort.targetSd!=null&&cohort.targetSd>0)L.sourceTargetSd=cohort.targetSd;sgSetLevelTeaSnapshot(t,e,level,forceTea);return{imported:true,cleared:false,status:assessment.status,mixedTarget:cohort.issues.includes('mixed-target-mean')||cohort.issues.includes('mixed-target-sd')};}
function sgApplyCohortChoices(t,e,groups,choices){const summary={imported:0,cleared:0,insufficient:0,unstable:0,mixedTargets:0,missingLotN:0,missingLotLevels:0};(groups||[]).forEach(g=>{const lot=choices&&choices[g.level],cohort=g.cohorts.find(c=>c.lot===lot),r=sgImportCohort(t,e,g.level,cohort);if(r.imported){summary.imported++;if(r.status==='insufficient')summary.insufficient++;if(r.status==='unstable')summary.unstable++;if(r.mixedTarget)summary.mixedTargets++;}if(r.cleared)summary.cleared++;
  /* Điểm IQC chưa gắn mã lô bị loại khỏi cohort (không thể tách lô) — chỉ báo khi
     mức đó không có cohort hợp lệ nào, để không nhiễu khi đã lấy được CV từ lô đúng. */
  if(g.missingLotN&&!g.cohorts.length){summary.missingLotN+=g.missingLotN;summary.missingLotLevels++;}});return summary;}
function sgCohortImportMessage(e,s){const notes=[];if(s.missingLotLevels)notes.push(s.missingLotN+' điểm IQC ('+s.missingLotLevels+' mức) chưa gắn mã lô QC nên không dùng được — hãy gắn mã lô cho điểm QC để lấy CV tự động');if(s.mixedTargets)notes.push(s.mixedTargets+' mức thay đổi Mean/SD mục tiêu nên nhóm dữ liệu IQC chưa ổn định');if(s.unstable)notes.push(s.unstable+' mức không được phân loại');if(s.cleared)notes.push(s.cleared+' CV tự động cũ đã được xóa');if(!s.imported)return'Kỳ '+(vnPeriod(e.period)||e.period)+' chưa có đủ dữ liệu IQC của cùng một lô để tính CV (cần ít nhất 2 kết quả hợp lệ).'+(notes.length?' '+notes.join('. ')+'.':'');return'Đã lấy CV theo lô đến '+vnDate(sgCohortCutoff(e.period))+'.'+(s.insufficient?' Có '+s.insufficient+' mức dưới 20 điểm; Sigma chỉ hiển thị ước tính.':'')+(notes.length?' '+notes.join('. ')+'.':'');}
function sgRenderCohortModal(){const c=sgCohortCtx;if(!c)return;const sections=c.groups.map(g=>{if(!g.cohorts.length)return`<tr><td>Mức ${g.level}</td><td colspan="5" class="muted">${g.missingLotN?`Có ${g.missingLotN} điểm IQC chưa gắn mã lô QC — hãy gắn mã lô cho điểm QC để dùng làm CV.`:'Không có nhóm dữ liệu IQC đã gắn mã lô trong kỳ đánh giá.'}</td></tr>`;const preferred=g.cohorts.find(x=>x.lot===g.configuredLot)||g.cohorts[g.cohorts.length-1];return g.cohorts.map((x,i)=>{const a=SigmaCohortService.assess(x),checked=x===preferred?'checked':'';return`<tr><td>${i?'':`Mức ${g.level}`}</td><td><label><input type="radio" name="sgCohort_${g.level}" value="${escAttr(x.lot)}" ${checked}> Lô ${esc(x.lot)}</label></td><td>${vnDate(x.start)}–${vnDate(x.end)}</td><td class="num">${x.n}</td><td class="num">${x.stats&&x.stats.cv>0?fmt(x.stats.cv,2)+'%':'—'}</td><td>${esc(sgCohortStatusText(a))}</td></tr>`;}).join('');}).join('');openModal(`<div class="modal"><div class="modal-h"><h3>Chọn dữ liệu CV IQC theo lô — ${esc(testDisplayName(c.t))}</h3><button class="modal-close" onclick="sgCohortClose()">✕</button></div><div class="modal-b"><div class="hint" style="margin-bottom:10px">Dữ liệu IQC được gom xuyên tháng nhưng luôn tách theo lô và mức QC. Nếu Mean/SD mục tiêu thay đổi, nhóm dữ liệu sẽ được đánh dấu không ổn định. Dữ liệu được tính đến ${vnDate(sgCohortCutoff(c.e.period))}.</div><table><thead><tr><th>Mức</th><th>Lô QC</th><th>Khoảng dữ liệu</th><th class="num">n</th><th class="num">CV</th><th>Trạng thái</th></tr></thead><tbody>${sections}</tbody></table></div><div class="modal-f">${btn('Hủy','sgCohortClose()','ghost')}${btn('✓ Dùng dữ liệu đã chọn','sgCohortApply()','teal')}</div></div>`);}
function sgCohortClose(){sgCohortCtx=null;closeModal();}
async function sgCohortApply(){if(!requireWrite()||!sgCohortCtx)return;const c=sgCohortCtx,choices={};c.groups.forEach(g=>{const el=document.querySelector(`input[name="sgCohort_${g.level}"]:checked`);if(el)choices[g.level]=el.value;});const summary=sgApplyCohortChoices(c.t,c.e,c.groups,choices);sgCohortCtx=null;save({clearDerived:false,sigmaTestId:sgTest});closeModal();rerender();await infoDialog(sgCohortImportMessage(c.e,summary));}
async function sgPullCV(eid){if(!requireWrite())return;sgCohortCtx=null;const t=state.tests.find(x=>x.id===sgTest);if(!t)return;const d=sgData(sgTest);if(!d.length){await infoDialog('Chưa có kỳ nào. Bấm “+ Thêm kỳ” trước.');return;}const sorted=[...d].sort((a,b)=>String(a.period||'').localeCompare(String(b.period||''))),e=(eid&&d.find(x=>x.id===eid))||sorted[sorted.length-1];e.lv=e.lv||{};sgEnsureTeaSnapshot(t,e);const groups=sgCohortGroups(t,e);if(groups.some(g=>g.cohorts.length>1)){sgCohortCtx={t,e,groups};sgRenderCohortModal();return;}const choices={};groups.forEach(g=>{if(g.cohorts[0])choices[g.level]=g.cohorts[0].lot;});const summary=sgApplyCohortChoices(t,e,groups,choices);save({clearDerived:false,sigmaTestId:sgTest});rerender();await infoDialog(sgCohortImportMessage(e,summary));}
