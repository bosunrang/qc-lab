/* ===== REPORT PAGE ROUTES ===== */
/* Tách khỏi actions-routes.js (2026-07-30): file đó giữ CẢ hai trang nên đã lên
   105 KB — đúng tình huống khiến pageDash()/pageEntry()/pageWestgard() được tách
   khỏi router-render.js trước đó. Hai trang không dùng chung một hàm nào (chỉ
   dùng chung professional-reports.css), nên đường cắt này không để lại tham
   chiếu chéo. Nạp ngay sau actions-routes.js; data-io.js/reports.js gọi
   reportDateRange()/reportRangeText() nhưng chỉ lúc người dùng bấm xuất/in nên
   thứ tự với hai file đó không bắt buộc — giữ liền mạch cho dễ đọc. */
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
/* Cả ba nút xuất (In / Excel / CSV) đọc cùng một bộ điều khiển trên trang Báo
   cáo. Gom về đây để đổi id ô nhập chỉ phải sửa một chỗ, và để bản in với bản
   Excel không thể lệch nhau về xét nghiệm, khoảng ngày hay tùy chọn phụ lục. */
function reportExportSelection(){
  const tid=(document.getElementById('rTest')||{}).value||'',{start,end}=typeof reportDateRange==='function'?reportDateRange():{start:'',end:''};
  return{tid,t:state.tests.find(x=>x.id===tid),start,end,includeNceAppendix:(document.getElementById('reportNceAppendix')||{}).checked!==false};
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
     <div class="report-lock-controls">
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
       <label class="report-nce-option"><input id="reportNceAppendix" type="checkbox" checked> Kèm phụ lục NCE đầy đủ trong PDF/Excel</label>
     </div>
   </div>`+reportLockPanelHtml();
}
function reportRangePicker(start,end){
  return `<div><label>Từ ngày</label>${dateBox('rStartDate',start,'','onchange="reportRangeChanged()"')}</div>
    <div><label>Đến ngày</label>${dateBox('rEndDate',end,'','onchange="reportRangeChanged()"')}</div>`;
}
