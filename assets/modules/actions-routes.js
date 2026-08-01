/* ===== ACTIONS PAGE ROUTES ===== */
/* Trang "Khắc phục sự cố" trừ phần form: danh sách sự cố cần xử lý, vòng đời hồ sơ
   NCE (duyệt / trả lại / hủy có lưu vết / escalate / mở lại) cùng token khóa phiên bản,
   phiếu chi tiết và các khối dựng bằng chứng. Toàn bộ phần DỰNG VÀ ĐỌC LẠI form 8 mục
   nằm ở action-form.js (tách 2026-07-30) — pageActionsV4() gọi sang actionFormHtml().
   Trang Báo cáo, vốn cũng từng ở file này, nay ở report-routes.js. */
/* Hồ sơ nguồn ngoài IQC không có mức/lô — không được hiện "M0 · Lô ?" ở nhật ký,
   báo cáo và phiếu chi tiết. */
function actionLevelShort(t,level,lotSnap){
  const n=parseInt(level);
  if(!Number.isFinite(n)||n<=0)return'Không gắn mức QC';
  const l=t&&lvlCfg(t,n),lot=lotSnap||(l&&l.lot)||'?';
  return `M${n} · Lô ${lot}`;
}
function currentIssues(){
  const out=[],rank={rej:2,warn:1,ok:0};
  operationalTests().forEach(t=>{const wg=activeWestgard(t);wg.views.forEach(v=>{const l=v.l;(v.pts||[]).forEach(p=>{const f=wg.byPoint.get(p.id);if(!f||f.level==='ok'||(typeof pointWorkflowComplete==='function'&&pointWorkflowComplete(p.id)))return;out.push({t,l,p,f,rules:f.rules});});});});
  return out.sort((a,b)=>(rank[b.f.level]||0)-(rank[a.f.level]||0)||String(b.p.date||'').localeCompare(String(a.p.date||'')));
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
function pageActionsV4(){
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
   actionFormHtml(issues.length)+
   `<div class="panel action-log-panel"><h3>Nhật ký khắc phục</h3>${rows?`<div class="action-log-tools">${btn('Xuất CSV nhật ký','exportActionsCSV()','teal sm')}</div><div class="action-log-wrap"><table class="action-log-table"><thead><tr><th>Thời điểm</th><th>Sự cố</th><th>Hành động</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table></div>`:emptyState('Chưa có nhật ký','Các hành động khắc phục sẽ xuất hiện ở đây sau khi được lưu.')}</div>`;
}

