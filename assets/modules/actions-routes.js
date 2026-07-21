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
function actionApprovalTag(a){const s=actionApprovalStatus(a),cls=s==='approved'?'ok':s==='returned'?'rej':'warn';return `<span class="tag ${cls}">${actionApprovalLabel(a)}</span>`;}
async function approveAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(!actionRecorded(a)){await infoDialog('Chưa có hành động khắc phục thực tế để duyệt. Hãy ghi hành động trước.');return;}
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Duyệt hành động khắc phục</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <label>Ý kiến duyệt (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Nhận xét về hành động khắc phục..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập ý kiến duyệt tối thiểu 3 ký tự.</div>
    </div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Đóng</button><button class="btn teal" onclick="confirmApproveAction(${i})">Duyệt</button></div>
  </div>`);
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
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Trả lại hành động khắc phục</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <label>Lý do trả lại (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Vì sao trả lại hành động khắc phục này..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần nhập lý do tối thiểu 3 ký tự.</div>
    </div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Đóng</button><button class="btn danger" onclick="confirmReturnAction(${i})">Trả lại</button></div>
  </div>`);
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
  return `<div class="action-row-actions">${s!=='approved'?`<button class="btn ghost sm" onclick="approveAction(${i})">Duyệt</button>`:''}${s!=='returned'?`<button class="btn ghost sm" onclick="returnAction(${i})">Trả lại</button>`:''}${btn('✕',`delAction(${i})`,'danger icon','Xóa nhật ký')}</div>`;
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
  return `<div class="issue-row ${o.f.level}"><div class="issue-row-main"><b>${esc(actionLevelShort(o.t,o.l.level,o.l.lot))} · ${stateName(o.f.level)}</b><div class="meta">${fmt(o.p.val)} ${esc(o.t.unit||'')} · ${rules||'—'} · ${err}</div><div class="action-chipline"><span class="action-chip ${wf.cls}">${esc(wf.label)}</span></div><div class="hint">${hint}</div></div>${canWrite()?`<button class="btn ghost sm" onclick="fillAction('${o.t.id}',${o.l.level},'${jsq(rules)}','${jsq(err)}','${jsq(hint)}','${jsq(o.p.id||'')}','${jsq(o.p.date||'')}')">${hasAction?'Bổ sung':'Ghi nhận'}</button>`:''}</div>`;
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
   `<div class="panel action-issues-panel"><h3>Sự cố cần xử lý</h3><div class="dash-list">${issueHtml}</div></div>`+
   `<div class="panel action-form-panel"><h3>Ghi nhận hành động</h3>${tests.length?`<div class="action-form-body"><div class="action-form-main">
     <input id="aPointId" type="hidden">
     <input id="aLevel" type="hidden" value="${firstLevel?firstLevel.level:''}">
     <div><label>Xét nghiệm</label><select id="aTest" onchange="syncActLevels()">${opts}</select></div>
     <div><label>Ngữ cảnh QC</label><input id="aLevelLabel" readonly value="${escAttr(firstLevelLabel)}"></div>
     <div><label>Ngày</label>${dateBox('aDate',isoToday(),'action-date')}</div>
     <div><label>Luật vi phạm</label><input id="aRule" placeholder="VD: 2-2s"></div></div>
     <div class="action-form-row2" style="margin-top:8px"><div><label>Loại sai số</label><select id="aErr"><option>SE — Sai số hệ thống</option><option>RE — Sai số ngẫu nhiên</option></select></div><div><label>Người thực hiện</label><input id="aBy"></div><div><label>Hành động khắc phục</label><input id="aAct" placeholder="VD: Hiệu chuẩn lại, chạy QC mới, kiểm tra hóa chất..."></div></div>
      <div style="margin-top:12px"><button class="btn teal" onclick="addAction()">Lưu hành động</button></div></div>`:emptyState('Cần có xét nghiệm trước','Khai báo xét nghiệm rồi quay lại ghi nhận hành động khắc phục.',role()==='admin'?btn('Thêm xét nghiệm',`go('manage')`,'teal'):'')}</div>
   <div class="panel action-log-panel"><h3>Nhật ký khắc phục</h3>${rows?`<div class="action-log-tools"><button class="btn ghost sm" onclick="exportActionsCSV()">Xuất Excel nhật ký</button></div><div class="action-log-wrap"><table class="action-log-table"><thead><tr><th>Ngày</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState('Chưa có nhật ký','Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.')}</div>`;
}

let reportQ='',reportTest='',reportRangeStart='',reportRangeEnd='';
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
  print:'<path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/><path d="M18 12h.01"/>',
  excel:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 12h8M8 16h8M12 10v8"/>',
  csv:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 12h8M8 16h8M8 20h5"/>'
};
function reportActionIcon(type){
  const paths=REPORT_ACTION_ICON_PATHS[type]||REPORT_ACTION_ICON_PATHS.csv;
  return `<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
function pageReportV2(){
  const tests=operationalTests();
  if(!tests.length)return headOnly('Báo cáo & Biểu mẫu','')+`<div class="panel">${emptyState('Chưa có xét nghiệm đang vận hành','Cần có Panel QC, Nhóm lô QC, Mean/SD và dữ liệu QC trước khi tạo báo cáo.',role()==='admin'?btn('Cấu hình Mean/SD',`go('manage');setManageTab('targets')`,'teal'):'')}</div>`;
  const q=searchText(reportQ),matched=tests.filter(t=>!q||reportSearchValues(t).some(v=>searchText(v).includes(q)));
  if(matched.length&&(!reportTest||!matched.some(t=>t.id===reportTest)))reportTest=matched[0].id;
  if(!matched.length)reportTest='';
  const opts=matched.length?matched.map(t=>`<option value="${escAttr(t.id)}" ${t.id===reportTest?'selected':''}>${esc(testSelectLabel(t,tests))}</option>`).join(''):'<option value="">Không tìm thấy xét nghiệm phù hợp</option>';
  const{start,end}=reportRangeDefaults();
  return headOnly('Báo cáo & Biểu mẫu','Tổng hợp hồ sơ nội kiểm theo khoảng ngày lựa chọn')+
   `<div class="panel"><h3>Báo cáo nội kiểm theo ngày</h3>
     <div class="grid4"><div><label>Tìm xét nghiệm</label><input id="reportSearch" type="search" placeholder="Tìm tên xét nghiệm" value="${escAttr(reportQ)}" oninput="reportSearchSet(this.value)"></div>
       <div><label>Xét nghiệm <span id="reportTestCount" class="hint">(${matched.length}/${tests.length})</span></label><select id="rTest" ${matched.length?'':'disabled'} onchange="reportTest=this.value">${opts}</select></div>
       ${reportRangePicker(start,end)}</div>
     <div class="report-actions">
       <button class="btn teal" data-report-action ${matched.length?'':'disabled'} onclick="printReport()">${reportActionIcon('print')}Tạo báo cáo &amp; In</button>
       <button class="btn ghost" data-report-action ${matched.length?'':'disabled'} onclick="exportReportXLSX()">${reportActionIcon('excel')}Xuất Excel</button>
       <button class="btn ghost" data-report-action ${matched.length?'':'disabled'} onclick="exportReportCSV()">${reportActionIcon('csv')}Xuất CSV</button>
     </div>
     <div class="hint">Báo cáo gồm: thông tin đơn vị, biểu đồ Levey-Jennings tổng hợp và từng mức, bảng Mean/SD/CV/Bias/TE/TEa/Sigma, các điểm vi phạm Westgard, nhật ký khắc phục trong khoảng ngày đã chọn, và ô ký duyệt. File .xlsx giữ nguyên bảng cột và biểu đồ như báo cáo in; bản in bấm “Lưu thành PDF”.</div>
   </div>`;
}
function reportRangePicker(start,end){
  return `<div><label>Từ ngày</label>${dateBox('rStartDate',start,'','onchange="reportRangeChanged()"')}</div>
    <div><label>Đến ngày</label>${dateBox('rEndDate',end,'','onchange="reportRangeChanged()"')}</div>`;
}

