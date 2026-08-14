/* ===== ACTIONS PAGE ROUTES ===== */
/* Trang "Khắc phục sự cố" trừ phần form: danh sách sự cố cần xử lý, vòng đời hồ sơ
   NCE (duyệt / trả lại / hủy có lưu vết / escalate / mở lại) cùng token khóa phiên bản,
   phiếu chi tiết và các khối dựng bằng chứng. Toàn bộ phần DỰNG VÀ ĐỌC LẠI form 8 mục
   nằm ở action-form.js (tách 2026-07-30) — pageActionsV4() gọi sang actionFormHtml().
   Trang Báo cáo, vốn cũng từng ở file này, nay ở report-routes.js. */
/* Hồ sơ nguồn ngoài IQC không có mức/lô — không được hiện "M0 · Lô ?" ở nhật ký,
   báo cáo và phiếu chi tiết. */
function actionLevelShort(t,level,lotSnap){
  return ActionListPresentation.levelShort(t,level,lotSnap);
}
function currentIssues(){return globalThis.ActionCurrentIssues();}
async function cancelAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  const readiness=ActionReviewService.cancelReadiness(a);if(!readiness.ok){await infoDialog(actionReviewReadinessMessage('cancel',{...readiness,action:a},false));return;}
  const id=a.id,token=actionApprovalToken(a);
  if(!await reauthenticateCurrentUser({title:'Xác thực hủy hồ sơ NCE',message:'Nhập lại mật khẩu trước khi hủy hồ sơ. Toàn bộ nội dung vẫn được giữ lại trong nhật ký.'}))return;
  const current=(state.actions||[]).find(x=>x.id===id);
  if(!current||actionApprovalToken(current)!==token){await infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi hủy.');return;}
  openModal(modalTemplate({title:'Hủy hồ sơ NCE',body:`
      <div class="alert warn action-cancel-warning"><b>Hồ sơ sẽ không bị xóa.</b><div>Nội dung, người lập và toàn bộ bằng chứng vẫn được giữ để truy xuất. Nếu hồ sơ gắn với vi phạm QC, sự cố đó sẽ xuất hiện lại để lập hồ sơ mới.</div></div>
      <label>Lý do hủy (tối thiểu 5 ký tự)</label>
      <textarea id="actionCancelReason" placeholder="VD: Mở nhầm cho sai điểm QC; lập lại hồ sơ đúng đối tượng..." oninput="document.getElementById('actionCancelErr').style.display='none'"></textarea>
      <div id="actionCancelErr" class="hint field-error">Cần nhập lý do hủy tối thiểu 5 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Hủy hồ sơ',`confirmCancelAction('${jsq(current.id)}','${jsq(token)}')`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('actionCancelReason');if(e)e.focus();},50);
}
function confirmCancelAction(id,token){
  const a=(state.actions||[]).find(x=>x.id===id);if(!a){closeModal();return;}
  if(role()!=='admin'){closeModal();infoDialog('Chỉ quản trị viên mới được hủy hồ sơ NCE.');return;}
  if(actionApprovalToken(a)!==token){closeModal();infoDialog('Hồ sơ đã thay đổi. Vui lòng mở lại và kiểm tra trước khi hủy.');return;}
  const readiness=ActionReviewService.cancelReadiness(a);if(!readiness.ok){closeModal();if(readiness.reason==='cancelled'){rerender();return;}infoDialog(actionReviewReadinessMessage('cancel',{...readiness,action:a},true));return;}
  const input=document.getElementById('actionCancelReason'),reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<5){const err=document.getElementById('actionCancelErr');if(err)err.style.display='';return;}
  closeModal();
  if(!ActionReviewService.cancel(a,reason,userName())){closeModal();rerender();return;}
  logAct('Hủy hồ sơ NCE',`${a.nceId||a.id||'NCE'} · ${reason}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');
  if(actionEditId===a.id){actionEditId='';actionSeed=null;clearActionDraft();actionOpenSections=null;}
  save({clearDerived:false});rerender();
}
function actionApprovalTag(a){const s=actionApprovalStatus(a),view=ActionReviewPresentation.approvalTag(s,actionCancelled(a)),label=actionApprovalLabel(a);return globalThis.actionApprovalTagPresentation(view,label);}
function actionApprovalToken(a){return ActionReviewService.reviewToken(a);}
function actionApprovalReadinessMessage(r,afterAuth){
  return globalThis.ActionReviewMessages.approval(r,afterAuth);
}
function actionReviewReadinessMessage(kind,r,afterAuth){
  return globalThis.ActionReviewMessages.review(kind,r,afterAuth);
}
async function approveAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  const approvalId=a.id,preAuthToken=actionApprovalToken(a),readiness=ActionReviewService.approvalReadiness(a,currentUser);if(!readiness.ok){await infoDialog(actionApprovalReadinessMessage(readiness,false));return;}
  if(!await reauthenticateCurrentUser({title:'Xác thực người duyệt',message:'Nhập lại mật khẩu trước khi duyệt hành động khắc phục.'}))return;
  const current=(state.actions||[]).find(x=>x.id===approvalId);if(!current||actionApprovalToken(current)!==preAuthToken){await infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi duyệt.');return;}
  const token=actionApprovalToken(current);
  openModal(modalTemplate({title:'Duyệt hành động khắc phục',body:`
      <label>Ý kiến duyệt (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Nhận xét về hành động khắc phục..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint field-error">Cần nhập ý kiến duyệt tối thiểu 3 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Duyệt',`confirmApproveAction('${jsq(current.id)}','${jsq(token)}')`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmApproveAction(id,token){
  const a=(state.actions||[]).find(x=>x.id===id);if(!a){closeModal();return;}
  if(role()!=='admin'){closeModal();infoDialog('Chỉ quản trị viên mới được duyệt hồ sơ.');return;}
  if(actionApprovalToken(a)!==token){closeModal();infoDialog('Hồ sơ hoặc bằng chứng QC đã thay đổi. Vui lòng mở lại và kiểm tra trước khi duyệt.');return;}
  const readiness=ActionReviewService.approvalReadiness(a,currentUser);if(!readiness.ok){closeModal();infoDialog(actionApprovalReadinessMessage(readiness,true));return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<3){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  if(!ActionReviewService.approve(a,note,userName())){closeModal();rerender();return;}
  logAct('Duyệt khắc phục',`${a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
async function returnAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  const readiness=ActionReviewService.returnReadiness(a);if(!readiness.ok){await infoDialog(actionReviewReadinessMessage('return',readiness,false));return;}
  const returnId=a.id,preAuthToken=actionApprovalToken(a);
  if(!await reauthenticateCurrentUser({title:'Xác thực người trả lại',message:'Nhập lại mật khẩu trước khi trả lại hành động khắc phục.'}))return;
  const current=(state.actions||[]).find(x=>x.id===returnId);
  if(!current||actionApprovalToken(current)!==preAuthToken||!ActionReviewService.returnReadiness(current).ok){await infoDialog('Hồ sơ đã thay đổi trong lúc xác thực. Vui lòng kiểm tra lại trước khi trả lại.');return;}
  const token=actionApprovalToken(current);
  openModal(modalTemplate({title:'Trả lại hành động khắc phục',body:`
      <label>Lý do trả lại (tối thiểu 3 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="Vì sao trả lại hành động khắc phục này..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint field-error">Cần nhập lý do tối thiểu 3 ký tự.</div>
    `,footer:btn('Đóng','closeModal()','ghost')+btn('Trả lại',`confirmReturnAction('${jsq(current.id)}','${jsq(token)}')`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('actionNoteInput');if(e)e.focus();},50);
}
function confirmReturnAction(id,token){
  const a=(state.actions||[]).find(x=>x.id===id);if(!a){closeModal();return;}
  if(role()!=='admin'){closeModal();infoDialog('Chỉ quản trị viên mới được trả lại hồ sơ.');return;}
  if(actionApprovalToken(a)!==token){closeModal();infoDialog('Hồ sơ hoặc bằng chứng QC đã thay đổi. Vui lòng mở lại và kiểm tra trước khi trả lại.');return;}
  const readiness=ActionReviewService.returnReadiness(a);if(!readiness.ok){closeModal();infoDialog(actionReviewReadinessMessage('return',readiness,true));return;}
  const input=document.getElementById('actionNoteInput');
  const note=QCCore.cleanText(input?input.value:'',1000).trim();
  if(note.length<3){const err=document.getElementById('actionNoteErr');if(err)err.style.display='';return;}
  closeModal();
  if(!ActionReviewService.returnForRevision(a,note,userName())){closeModal();rerender();return;}
  logAct('Trả lại khắc phục',`${a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
/* Hành động khắc phục không hiệu lực thì phải mở vòng điều tra mới chứ không treo hồ sơ
   cũ mãi. Hồ sơ mới thừa hưởng danh tính sự cố (xét nghiệm/mức/lô/điểm QC) và trỏ ngược
   về hồ sơ cũ qua parentNceId; hồ sơ cũ ghi followUpNceId để actionEffectivenessStatus()
   cho phép khép lại với kết luận "chưa hiệu lực — đã chuyển". */
function actionCanEscalate(a){return ActionEscalationService.canEscalate(state.actions||[],a);}
async function escalateAction(i){
  if(!requireWrite())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(!actionCanEscalate(a)){await infoDialog('Chỉ mở hồ sơ tiếp theo cho hồ sơ đã kết luận "chưa hiệu lực" và chưa từng chuyển.');return;}
  const t=state.tests.find(x=>x.id===a.testId),parent=a.nceId||'hồ sơ trước';
  if(!await confirmDialog({kicker:'Vòng điều tra mới',title:'Lập hồ sơ NCE tiếp theo?',message:`Hành động của ${parent} được kết luận chưa hiệu lực. Mở một hồ sơ mới để điều tra lại cùng sự cố này?`,detail:'Hồ sơ cũ sẽ được khép lại với kết luận "chưa hiệu lực — đã chuyển", giữ nguyên toàn bộ nội dung điều tra.',confirmLabel:'Lập hồ sơ tiếp theo',cancelLabel:'Hủy'}))return;
  const record=ActionEscalationService.createFollowUp(state.actions||[],a,{id:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',name:userName()});
  if(!record){await infoDialog('Hồ sơ đã thay đổi và không còn đủ điều kiện mở vòng tiếp theo.');return;}
  const nceId=record.nceId;
  logAct('Lập hồ sơ NCE tiếp theo',`${nceId} · nối tiếp ${parent} (hành động chưa hiệu lực)`,t?t.name:'Khắc phục');
  save({clearDerived:false});actionEditId=record.id;actionSeed=null;clearActionDraft();rerender();
  const panel=document.querySelector('.action-form-panel');if(panel)panel.scrollIntoView({behavior:'smooth',block:'start'});
}
/* Lối thoát cho hồ sơ kẹt: actionRerunStatus() tính động, nên một hồ sơ ĐÃ DUYỆT có thể
   tụt lại khỏi trạng thái khép vòng (ví dụ chính điểm QC dùng làm bằng chứng chạy lại
   sau đó bị hủy). Lúc đó sửa bị chặn vì đã duyệt, xóa bị chặn vì đã duyệt, nút Duyệt
   không hiện vì stage!=='approval' — không còn đường nào. Chỉ mở lại đúng trường hợp
   này, hồ sơ khép vòng hợp lệ vẫn bất biến theo quy ước cũ. */
function actionCanReopen(a){return ActionReviewService.canReopen(a);}
async function reopenAction(i){
  if(!requireAdmin())return;const a=state.actions&&state.actions[i];if(!a)return;
  if(!actionCanReopen(a)){await infoDialog('Chỉ mở lại được hồ sơ đã duyệt nhưng không còn đủ điều kiện khép vòng. Hồ sơ đã khép vòng hợp lệ thì mở hồ sơ NCE mới.');return;}
  if(!await reauthenticateCurrentUser({title:'Xác thực mở lại hồ sơ',message:'Nhập lại mật khẩu trước khi mở lại hồ sơ đã duyệt.'}))return;
  openModal(modalTemplate({title:'Mở lại hồ sơ đã duyệt',body:`
      <div class="alert warn">Hồ sơ đã duyệt nhưng điều kiện khép vòng không còn đúng: ${esc(actionWorkflowStatus(a).label)}.</div>
      <label>Lý do mở lại (tối thiểu 5 ký tự)</label>
      <textarea id="actionNoteInput" placeholder="VD: Điểm QC dùng làm bằng chứng chạy lại đã bị hủy..." oninput="document.getElementById('actionNoteErr').style.display='none'"></textarea>
      <div id="actionNoteErr" class="hint field-error">Cần nhập lý do tối thiểu 5 ký tự.</div>
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
  if(!ActionReviewService.reopen(a,note)){closeModal();rerender();return;}
  logAct('Mở lại hồ sơ NCE',`${a.nceId||a.rule||'—'} · ${note}`,a.testId?(state.tests.find(t=>t.id===a.testId)||{}).name||'Khắc phục':'Khắc phục');save({clearDerived:false});rerender();
}
function actionReviewButtons(i,a){
  const s=actionApprovalStatus(a),wf=actionWorkflowStatus(a),model=ActionReviewPresentation.buttons(a,{approval:s,workflowStage:wf.stage,cancelled:actionCancelled(a),isAdmin:role()==='admin',canWrite:canWrite(),canEscalate:actionCanEscalate(a),canReopen:actionCanReopen(a)});
  return globalThis.actionReviewButtonsHtml(i,model);
  return globalThis.actionReviewButtonsHtml(i,model);
}
/* Chip phụ dùng chung cho dòng vi phạm, dòng NCE đang mở và bảng nhật ký, để ba chỗ
   không lệch nhau (đúng lỗi chip QC chạy lại chỉ hiện ở một chỗ trước đây). */
function actionSideChips(a,stage){
  if(actionCancelled(a))return'';
  const chips=ActionStatusPresentation.sideChips(a,stage,actionRerunStatus(a),actionOverdue(a),actionEffectivenessStatus(a));
  return globalThis.actionSideChipsHtml(chips);
}
function actionDetailCheck(label,status,note){
  const view=ActionStatusPresentation.detailCheck(status);
  return globalThis.actionDetailCheckHtml(label,view,note);
}
function actionEvidenceTime(value,dateOnly=false){
  return ActionEvidencePresentation.time(value,dateOnly);
}
function actionEvidenceTimelineHtml(a,rr){
  const items=ActionEvidencePresentation.timeline(a,rr);
  return globalThis.actionEvidenceTimelinePresentation(items);
}
function actionRerunEvidenceHtml(a,rr,t){
  const evidence=ActionRerunEvidencePresentation.model(a,rr,t);
  return globalThis.actionRerunEvidencePresentation(evidence,a.testId,t);
}
function openActionQcEvidence(tid,level,pointId,date,lot){
  if(typeof captureActionDraft==='function'&&page==='actions')captureActionDraft();
  closeModal();entrySel={testId:tid,level:+level};entryStart=date||null;entryEnd=date||null;entryLastMsg=`<div class="alert ok">Đang hiển thị điểm QC được dùng làm bằng chứng ngày ${esc(vnDate(date))}.</div>`;
  entryDetailOpen.add('points');
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
  const legacy=!a.protocolVersion,modern=a.protocolVersion>=2,rr=actionRerunStatus(a),wf=actionWorkflowStatus(a),eff=actionEffectivenessStatus(a),residual=actionResidualRiskScore(a),overdue=actionOverdue(a);
  const verdict=actionQcVerdictLabel(a),violation=actionViolationInfo(a),metaRows=ActionDetailPresentation.meta(a,{testName:t?testDisplayName(t):'—',levelShort:actionLevelShort(t,a.level,a.lot),verdict,violation,riskScore:actionRiskScore(a),dueDate:a.dueDate?vnDate(a.dueDate):'—',overdueLabel:overdue.overdue?overdue.label:'',workflowLabel:wf.label}),meta=globalThis.actionDetailMetaHtml(metaRows);
  const cancelledAlert=globalThis.actionCancelledAlertHtml(actionCancelled(a)?{reason:a.cancelReason,by:a.cancelledBy,at:a.cancelledAt?formatDateTimeVN(a.cancelledAt):''}:undefined);
  const legacyDetail=globalThis.actionLegacyDetailHtml({action:a.action||'',owner:a.by||'',rerunLabel:rr.label||'',approvalLabel:actionApprovalLabel(a)});
  const body=legacy?`${cancelledAlert}<div class="alert warn">Bản ghi được tạo trước khi có phiếu điều tra 8 bước. Dữ liệu hành động cũ vẫn được giữ nguyên.</div>${meta}${legacyDetail}`:`
    ${cancelledAlert}${meta}${actionEvidenceTimelineHtml(a,rr)}${actionRerunEvidenceHtml(a,rr,t)}
    <ol class="action-detail-steps">
      ${globalThis.actionContainmentDetailHtml({status:ACTION_LABELS.containment[a.containmentStatus]||'',correction:a.correction||'',note:a.containmentNote||'',modern})}
      ${globalThis.actionInspectionDetailsHtml([{title:'Kiểm tra vật liệu QC',checksHtml:actionDetailCheck('Hạn dùng, bảo quản, hoàn nguyên và chuẩn bị',a.qcMaterialStatus,a.qcMaterialNote)},{title:'Kiểm tra máy phân tích',checksHtml:actionDetailCheck('Điện, nước, nhiệt độ, cảnh báo và bảo trì',a.instrumentStatus,a.instrumentNote)},{title:'Kiểm tra hóa chất / calibrator',checksHtml:actionDetailCheck('Hạn dùng, số lô, bảo quản và lot-to-lot',a.reagentStatus,a.reagentNote)+actionDetailCheck('So sánh lot-to-lot',a.lotToLotStatus,a.lotToLotNote)},{title:'Kiểm tra hiệu chuẩn',checksHtml:actionDetailCheck('Tình trạng hiệu chuẩn',a.calibrationStatus,a.calibrationNote)}])}
      ${globalThis.actionCauseDetailHtml({cause:a.cause||'',action:a.action||'',completedDate:a.actionCompletedDate?vnDate(a.actionCompletedDate):'',release:a.protocolVersion>=3&&a.containmentStatus==='held'?{status:ACTION_LABELS.release[a.releaseStatus]||'',details:a.releaseDate||a.releaseBy||a.releaseNote?`${a.releaseDate?vnDate(a.releaseDate)+' · ':''}${a.releaseBy||'Chưa ghi người cho phép'}${a.releaseNote?' · '+a.releaseNote:''}`:''}:undefined})}
      ${globalThis.actionPatientImpactHtml(ACTION_LABELS.patient[a.patientImpact]||'',a.patientAction||'')}
      ${globalThis.actionEffectivenessDetailHtml({effectiveness:modern?eff.label:a.cause||'—',note:modern&&a.effectivenessNote?`${a.effectivenessDate?vnDate(a.effectivenessDate)+' · ':''}${a.effectivenessNote}${a.effectivenessBy?' · '+a.effectivenessBy:''}`:'',residual:+a.protocolVersion>=3&&residual?{risk:ACTION_LABELS.risk[a.residualRiskLevel]||'',score:residual,basis:a.residualRiskBasis||''}:undefined,returned:a.returnNote?`${a.returnNote}${a.returnBy?' — '+a.returnBy:''}${a.returnAt?' · '+formatDateTimeVN(a.returnAt):''}`:'',followUpNceId:a.followUpNceId||'',parentNceId:a.parentNceId||'',approval:`${actionApprovalLabel(a)}${a.approvedBy?' · '+a.approvedBy:''}`,workflow:wf.label})}
    </ol>`;
  openModal(modalTemplate({title:'Chi tiết phiếu xử lý sự cố',body,footer:btn('Đóng','closeModal()','teal')}));
}
function openActionGuide(){
  const content=globalThis.actionGuideContent(ActionGuidePresentation.steps);
  openModal(modalTemplate({title:'Quy trình 8 bước xử lý hồ sơ NCE',body:content.body,footer:content.footer,cls:'action-guide-modal',bodyClass:''}));
}
function groupIssuesByTestDate(issues){
  return ActionListPresentation.groupIssuesByTestDate(issues);
}
/* Dòng vi phạm phải hiện luôn tình trạng QC chạy lại và mã hồ sơ, y như dòng ở mục
   "Hồ sơ NCE đang mở": hồ sơ của chính điểm này bị lọc khỏi mục đó để khỏi trùng
   (xem openActions trong pageActionsV4), nên nếu chỉ hiện một chip trạng thái thì
   chạy lại QC xong người dùng không thấy gì đổi ở đây cả. */
function issueRowHtml(o){
  const rules=o.rules.join(', '),err=errorType(o.rules),hint=fixHint(o.rules),wf=pointWorkflowSummary(o.p.id),acts=typeof pointRealActions==='function'?pointRealActions(o.p.id):[],latest=acts[acts.length-1],idx=latest?(state.actions||[]).indexOf(latest):-1;
  const sideChips=latest?actionSideChips(latest,actionWorkflowStatus(latest).stage):'';
  const foot=latest?`${latest.nceId?esc(latest.nceId)+' · ':''}Phụ trách: ${esc(latest.by||'—')}${latest.dueDate?' · hạn '+vnDate(latest.dueDate):''}`:hint;
  return globalThis.actionIssueRowPresentation({severity:o.f.level,level:actionLevelShort(o.t,o.l.level,o.l.lot),state:stateName(o.f.level),value:fmtPointValue(o.p,o.t),unit:o.t.unit||'',rules,error:err,workflowClass:wf.cls,workflowLabel:wf.label,sideChips,footer:foot,action:canWrite()?(idx>=0?{kind:'continue',index:idx}:{kind:'create',testId:o.t.id,level:o.l.level,rules,error:err,hint,pointId:o.p.id||'',date:o.p.date||''}):undefined});
}
/* Hồ sơ cũ tự sinh lúc hủy điểm chỉ lưu rule='Hủy điểm QC' — không phải luật Westgard.
   Suy |Z| của chính điểm đó ra ngữ cảnh đọc được, nhưng LUÔN gắn nhãn "suy từ Z" và
   không bao giờ ghi ngược vào bản ghi: luật thật có thể là 2-2s/R4s/4-1s chứ không chỉ
   luật đơn điểm, và khi thiếu snapshot Mean/SD thì phép suy này dùng Mean/SD hiện hành.
   addAction() vì vậy chỉ lưu giá trị người dùng gõ, còn CSV/Excel/bản in vẫn xuất
   a.rule gốc. */
function actionViolationInfo(a){
  return ActionViolationService.info(a);
}
function actionQcVerdictLabel(a){return ActionViolationService.verdictLabel(a);}
function openActionIssueHtml(a,idx){
  const t=state.tests.find(x=>x.id===a.testId),wf=actionWorkflowStatus(a),violation=actionViolationInfo(a),title=a.nceId||'Hồ sơ khắc phục',context=t?`${testDisplayName(t)} · ${actionLevelShort(t,a.level,a.lot)}`:(violation.rule||'Sự cố'),primary=a.correction||a.action||'Đang điều tra',verdict=actionQcVerdictLabel(a);
  return globalThis.actionOpenIssuePresentation({severity:wf.cls==='rej'?'rej':'warn',title,context,date:vnDate(actionEventDate(a)),verdict,rule:violation.rule,errorType:violation.errorType,workflowClass:wf.cls,workflowLabel:wf.label,sideChips:actionSideChips(a,wf.stage),primary,owner:a.by||'',dueDate:a.dueDate?vnDate(a.dueDate):'',editable:canWrite(),index:idx});
}
function actionIssueGroupHtml(model){return globalThis.actionIssueGroupPresentation(model);}
function pageActionsV4(){
  const issues=currentIssues(),activePointIds=new Set(issues.map(o=>o.p.id));
  const issueGroups=groupIssuesByTestDate(issues);
  const violationHtml=issueGroups.map(g=>actionIssueGroupHtml({severity:g.worst,title:testDisplayName(g.t),date:vnDate(g.date),count:g.items.length,countLabel:'vi phạm',itemsHtml:g.items.map(issueRowHtml).join('')})).join('');
  const openActions=(state.actions||[]).map((a,idx)=>({a,idx})).filter(({a})=>!actionCancelled(a)&&actionRecorded(a)&&!actionWorkflowStatus(a).complete&&(!a.pointId||!activePointIds.has(a.pointId)));
  const openActionHtml=openActions.length?actionIssueGroupHtml({severity:'warn',title:'Hồ sơ NCE đang mở',date:'Cần tiếp tục xử lý',count:openActions.length,countLabel:'hồ sơ',itemsHtml:openActions.map(({a,idx})=>openActionIssueHtml(a,idx)).join('')}):'';
  const issueHtml=violationHtml+openActionHtml||'<div class="alert ok">Không có vi phạm/cảnh báo hoặc hồ sơ NCE đang mở.</div>';
  const rows=(state.actions||[]).slice().reverse().map((a,idx)=>{const realIdx=state.actions.length-1-idx,t=state.tests.find(x=>x.id===a.testId),wf=actionWorkflowStatus(a),approval=actionApprovalStatus(a),openedAt=a.createdAt?formatDateTimeVN(a.createdAt):'',primary=a.action||a.correction||'Đang điều tra';
    const approveMeta=approval==='pending'?'':`<div class="action-note">${esc(a.approvedBy||'')} ${a.approvedAt?formatDateTimeVN(a.approvedAt):''}${a.approvalNote?' · '+esc(a.approvalNote):''}</div>`;
    const identity=`${a.nceId?esc(a.nceId)+' · ':''}${t?esc(testDisplayName(t)):esc(a.rule||'Cập nhật')}`,sub=t?esc(actionLevelShort(t,a.level,a.lot)):esc(a.lot?'Nhóm lô '+a.lot:'—'),rule=t?(actionQcVerdictLabel(a)?esc(actionQcVerdictLabel(a))+' · ':'')+esc(actionViolationInfo(a).rule)+' · '+esc(actionViolationInfo(a).errorType):esc(a.errorType||'—');
    const model={date:vnDate(actionEventDate(a)),openedAt,identity,sub,rule,primary,owner:a.by||'',dueDate:a.dueDate?vnDate(a.dueDate):'',workflowClass:wf.cls,workflowLabel:wf.label,sideChips:actionSideChips(a,wf.stage),approvalTag:!actionCancelled(a)&&approval!=='pending'?actionApprovalTag(a):'',approvalMeta:approveMeta,actions:actionReviewButtons(realIdx,a)};
    return globalThis.actionLogRowPresentation(model);}).join('');
  const head=headOnly('Khắc phục sự cố','Điều tra nguyên nhân, ghi nhận, chạy lại QC và phê duyệt khép vòng'),issuesPanel=globalThis.actionIssuesPanelHtml(issueHtml),formPanel=actionFormHtml(issues.length),logPanel=globalThis.actionLogPanelHtml(rows);
  return globalThis.actionPageHtml({headHtml:head,issuesHtml:issuesPanel,formHtml:formPanel,logHtml:logPanel});
}
