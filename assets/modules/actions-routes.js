/* ===== ACTIONS & REPORT PAGE ROUTES ===== */
function actionLevelLabel(l){
  if(!l)return 'Mức ?';
  const lot=l.lot?` · Lô ${l.lot}`:' · Chưa có lô';
  const range=` · Mean ${fmt(l.mean)} · SD ${fmt(l.sd,3)}`;
  const band=l.applied?` · ${l.applied==='lab'?'PXN':'NSX'}`:'';
  return `Mức ${l.level}${lot}${range}${band}`;
}
function actionLevelShort(t,level,lotSnap){
  const l=t&&lvlCfg(t,parseInt(level));
  const lot=lotSnap||(l&&l.lot)||'?';
  return `M${level} · Lô ${lot}`;
}
function syncActLevels(){
  const t=state.tests.find(x=>x.id===document.getElementById('aTest').value),levelEl=document.getElementById('aLevel'),labelEl=document.getElementById('aLevelLabel');
  if(!t||!levelEl)return;
  const levels=operationalLevels(t),l=levels.find(x=>String(x.level)===String(levelEl.value))||levels[0];
  if(l)levelEl.value=l.level;
  if(labelEl)labelEl.value=l?actionLevelLabel(l):'';
}
function currentIssues(){
  const out=[],rank={rej:2,warn:1,ok:0};
  operationalTests().forEach(t=>{const wg=activeWestgard(t);wg.views.forEach(v=>{const l=v.l;(v.pts||[]).forEach(p=>{const f=wg.byPoint.get(p.id);if(!f||f.level==='ok'||(typeof pointWorkflowComplete==='function'&&pointWorkflowComplete(p.id)))return;out.push({t,l,p,f,rules:f.rules});});});});
  return out.sort((a,b)=>(rank[b.f.level]||0)-(rank[a.f.level]||0)||String(b.p.date||'').localeCompare(String(a.p.date||'')));
}
function fillAction(tid,level,rule,err,act,pointId='',pointDate=''){document.getElementById('aTest').value=tid;document.getElementById('aLevel').value=level;syncActLevels();document.getElementById('aDate').value=vnDate(pointDate||isoToday());document.getElementById('aRule').value=rule;document.getElementById('aErr').value=err;document.getElementById('aAct').value=act;document.getElementById('aBy').value=currentUser?(currentUser.name||currentUser.username):'';const pid=document.getElementById('aPointId');if(pid)pid.value=pointId;document.getElementById('aAct').focus();}
async function addAction(){if(!requireWrite())return;state.actions=state.actions||[];const tid=document.getElementById('aTest').value,t=state.tests.find(x=>x.id===tid),level=parseInt(document.getElementById('aLevel').value),l=t?lvlCfg(t,level):null,rule=QCCore.cleanText(document.getElementById('aRule').value),action=QCCore.cleanText(document.getElementById('aAct').value,5000).trim(),by=QCCore.cleanText(document.getElementById('aBy').value).trim(),errorType=QCCore.cleanText(document.getElementById('aErr').value),pointId=QCCore.cleanText((document.getElementById('aPointId')||{}).value,80).trim();if(action.length<5){await infoDialog('Cần ghi hành động khắc phục tối thiểu 5 ký tự.');return;}if(!by){await infoDialog('Nhập người thực hiện hành động khắc phục.');return;}state.actions.push({id:uid(),date:parseVN(document.getElementById('aDate').value)||isoToday(),createdAt:new Date().toISOString(),testId:tid,level,lot:l&&l.lot||'',pointId,rule,errorType,action,by,approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});logAct('Ghi khắc phục',`${actionLevelShort(t,level,l&&l.lot)} · ${rule||'—'} · ${action||''} · chờ duyệt`,t?t.name:'');save({clearDerived:false});rerender();}
async function delAction(i){if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;if(actionApprovalStatus(a)==='approved'){await infoDialog('Không xóa hành động đã duyệt. Nếu cần, hãy ghi bổ sung một hành động mới.');return;}if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa hành động khắc phục',message:'Xóa hành động khắc phục này?',detail:'Nhật ký audit vẫn giữ lại thao tác xóa.',confirmLabel:'Xóa',cancelLabel:'Hủy'}))return;state.actions.splice(i,1);logAct('Xóa khắc phục',`${a.rule||'—'} · ${a.action||''}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();}
function actionApprovalTag(a){const s=actionApprovalStatus(a),cls=s==='approved'?'ok':s==='returned'?'rej':'warn';return `<span class="tag ${cls}">${actionApprovalLabel(a)}</span>`;}
async function approveAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(!actionRecorded(a)){await infoDialog('Chưa có hành động khắc phục thực tế để duyệt. Hãy ghi hành động trước.');return;}
  openModal(modalTemplate({title:'Duyệt hành động khắc phục',body:`
      <label>Ý kiến duyệt (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Nhận xét về hành động khắc phục..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập ý kiến duyệt tối thiểu 3 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Duyệt',`confirmApproveAction(${i})`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmApproveAction(i){
  const a=state.actions&&state.actions[i];if(!a){closeModal();return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<3){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  a.approvalStatus='approved';a.approvedAt=new Date().toISOString();a.approvedBy=userName();a.approvalNote=note;
  logAct('Duyệt khắc phục',`${a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
function returnAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  openModal(modalTemplate({title:'Trả lại hành động khắc phục',body:`
      <label>Lý do trả lại (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Vì sao trả lại hành động khắc phục này..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập lý do tối thiểu 3 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Trả lại',`confirmReturnAction(${i})`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmReturnAction(i){
  const a=state.actions&&state.actions[i];if(!a){closeModal();return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<3){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  a.approvalStatus='returned';a.approvedAt=new Date().toISOString();a.approvedBy=userName();a.approvalNote=note;
  logAct('Trả lại khắc phục',`${a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
function actionReviewButtons(i,a){
  if(role()!=='admin')return '';
  if(!actionRecorded(a))return '<span class="hint">Chờ KTV ghi nhận</span>';
  const s=actionApprovalStatus(a);
  return `<div class="action-row-actions">${s!=='approved'?btn('Duyệt',`approveAction(${i})`,'ghost sm'):''}${s!=='returned'?btn('Trả lại',`returnAction(${i})`,'ghost sm'):''}${btn('✕',`delAction(${i})`,'danger icon','Xóa nhật ký')}</div>`;
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
function issueRowHtml(o){
  const rules=o.rules.join(', '),err=errorType(o.rules),hint=fixHint(o.rules),wf=pointWorkflowSummary(o.p.id),hasAction=typeof pointRealActions==='function'&&pointRealActions(o.p.id).length>0;
  return `<div class="issue-row ${o.f.level}"><div class="issue-row-main"><b>${esc(actionLevelShort(o.t,o.l.level,o.l.lot))} · ${stateName(o.f.level)}</b><div class="meta">${fmt(o.p.val)} ${esc(o.t.unit||'')} · ${rules||'—'} · ${err}</div><div class="action-chipline"><span class="action-chip ${wf.cls}">${esc(wf.label)}</span></div><div class="hint">${hint}</div></div>${canWrite()?btn(hasAction?'Bổ sung':'Ghi nhận',`fillAction('${o.t.id}',${o.l.level},'${jsq(rules)}','${jsq(err)}','${jsq(hint)}','${jsq(o.p.id||'')}','${jsq(o.p.date||'')}')`,'ghost sm'):''}</div>`;
}
function pageActionsV4(){
  const tests=operationalTests(),opts=tests.map(t=>`<option value="${escAttr(t.id)}">${esc(testDisplayName(t))}</option>`).join('');
  const firstTest=tests[0],firstLevel=firstTest&&operationalLevels(firstTest)[0],firstLevelLabel=firstLevel?actionLevelLabel(firstLevel):'';
  const issues=currentIssues();
  const issueGroups=groupIssuesByTestDate(issues);
  const issueHtml=issueGroups.length?issueGroups.map(g=>`<div class="issue-group ${g.worst}"><div class="issue-group-h"><div><b>${esc(testDisplayName(g.t))}</b><span class="issue-group-date">${vnDate(g.date)}</span></div><span class="issue-group-count">${g.items.length} vi phạm</span></div><div class="issue-group-body">${g.items.map(issueRowHtml).join('')}</div></div>`).join(''):'<div class="alert ok">Không có vi phạm/cảnh báo mới cần ghi nhận.</div>';
  const rows=(state.actions||[]).slice().reverse().map((a,idx)=>{const realIdx=state.actions.length-1-idx,t=state.tests.find(x=>x.id===a.testId),wf=actionWorkflowStatus(a),rerun=actionRerunStatus(a),approval=actionApprovalStatus(a),createdTime=a.createdAt?formatDateTimeVN(a.createdAt).split(' ')[0]:'';
    const approveMeta=approval==='pending'?'':`<div class="action-note">${esc(a.approvedBy||'')} ${a.approvedAt?formatDateTimeVN(a.approvedAt):''}${a.approvalNote?' · '+esc(a.approvalNote):''}</div>`;
    return `<tr>
      <td><div class="action-date">${vnDate(a.date)}</div>${createdTime?`<div class="action-time">${esc(createdTime)}</div>`:''}</td>
      <td><div class="action-test">${t?esc(testDisplayName(t)):esc(a.rule||'Cập nhật')}</div><div class="action-sub">${t?esc(actionLevelShort(t,a.level,a.lot)):esc(a.lot?'Nhóm lô '+a.lot:'—')}</div><div class="action-rule">${t?esc(a.rule||'—')+' · '+esc(a.errorType||'—'):esc(a.errorType||'—')}</div></td>
      <td><div class="action-text">${esc(a.action||'')}</div><div class="action-sub">Người thực hiện: ${esc(a.by||'—')}</div></td>
      <td><div class="action-status-stack"><span class="action-chip ${rerun.cls}">${esc(rerun.label)}</span>${actionApprovalTag(a)}<span class="action-chip ${wf.cls}">${esc(wf.complete?'Hoàn tất':'Chưa hoàn tất')}</span>${approveMeta}</div></td>
      <td>${actionReviewButtons(realIdx,a)}</td>
    </tr>`;}).join('');
  return headOnly('Khắc phục sự cố','Ghi nhận, chạy lại QC sau điểm loại và phê duyệt hành động')+
   `<div class="panel action-issues-panel"><h3 role="heading" aria-level="2">Sự cố cần xử lý</h3><div class="dash-list">${issueHtml}</div></div>`+
   `<div class="panel action-form-panel"><h3>Ghi nhận hành động</h3>${tests.length?`<div class="action-form-body"><div class="action-form-main">
     <input id="aPointId" type="hidden">
     <input id="aLevel" type="hidden" value="${firstLevel?firstLevel.level:''}">
     <div><label>Xét nghiệm</label><select id="aTest" aria-label="Xét nghiệm" onchange="syncActLevels()">${opts}</select></div>
     <div><label>Ngữ cảnh QC</label><input id="aLevelLabel" aria-label="Ngữ cảnh QC" readonly value="${escAttr(firstLevelLabel)}"></div>
     <div><label>Ngày</label>${dateBox('aDate',isoToday(),'action-date')}</div>
     <div><label>Luật vi phạm</label><input id="aRule" placeholder="VD: 2-2s"></div></div>
     <div class="action-form-row2" style="margin-top:8px"><div><label>Loại sai số</label><select id="aErr" aria-label="Loại sai số"><option>SE — Sai số hệ thống</option><option>RE — Sai số ngẫu nhiên</option></select></div><div><label>Người thực hiện</label><input id="aBy" aria-label="Người thực hiện"></div><div><label>Hành động khắc phục</label><input id="aAct" placeholder="VD: Hiệu chuẩn lại, chạy QC mới, kiểm tra hóa chất..."></div></div>
      <div style="margin-top:12px">${btn('Lưu hành động','addAction()','teal')}</div></div>`:emptyState('Cần có xét nghiệm trước','Khai báo xét nghiệm rồi quay lại ghi nhận hành động khắc phục.',role()==='admin'?btn('Thêm xét nghiệm',`go('manage')`,'teal'):'')}</div>
   <div class="panel action-log-panel"><h3>Nhật ký khắc phục</h3>${rows?`<div class="action-log-tools">${btn('Xuất Excel nhật ký','exportActionsCSV()','teal sm')}</div><div class="action-log-wrap"><table class="action-log-table"><thead><tr><th>Ngày</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState('Chưa có nhật ký','Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.')}</div>`;
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
  closeModal();
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
     <div class="hint">Báo cáo gồm: thông tin đơn vị, biểu đồ Levey-Jennings tổng hợp và từng mức, bảng Mean/SD/CV/Bias/TE/TEa/Sigma, các điểm vi phạm Westgard, nhật ký khắc phục trong khoảng ngày đã chọn, và ô ký duyệt. File .xlsx giữ nguyên bảng cột và biểu đồ như báo cáo in; bản in bấm “Lưu thành PDF”.</div>
   </div>`+reportLockPanelHtml();
}
function reportRangePicker(start,end){
  return `<div><label>Từ ngày</label>${dateBox('rStartDate',start,'','onchange="reportRangeChanged()"')}</div>
    <div><label>Đến ngày</label>${dateBox('rEndDate',end,'','onchange="reportRangeChanged()"')}</div>`;
}

