/* ===== NEW QC RANGE ===== */
/* Thoát sớm khi không tìm thấy xét nghiệm/mức: openRangeWorkflow() vốn đã có
   `if(!r.t||!r.l)return;` nhưng guard đó là CODE CHẾT — lvlCfg(undefined,...) đọc
   t.levels nên hàm này nổ trước khi caller kịp kiểm tra. Xảy ra khi tid đã biến mất
   giữa chừng: modal/biểu mẫu in còn giữ tid cũ trong khi xét nghiệm bị xóa ở máy
   khác rồi merge Firebase về. Trả đúng hình dạng cũ với eligible=false để mọi caller
   (openRangeWorkflow, applyNewRange, entry-routes) đi vào nhánh "chưa đủ điều kiện"
   thay vì ném lỗi ra giữa lúc render. */
/* Hồ sơ NCE hệ thống (SE) gần nhất còn hiệu lực cho đúng xét nghiệm/mức này — dấu
   hiệu cho biết dải QC sắp áp dụng lại đang theo sau một dịch chuyển 2:2s/4:1s/
   8x/10x/7T, chứ không phải lần thiết lập dải thường quy. Bỏ qua hồ sơ đã hủy
   (actionCancelled): hồ sơ hủy không còn là căn cứ điều tra hợp lệ, giống cách
   action-workflow-service.js đã bỏ qua chúng khi tính có NCE thật cho một điểm QC
   hay không. rule lưu dạng chuỗi có thể ghép nhiều luật ("2-2s, 8x") nên phải
   tách theo dấu phẩy trước khi so với WG_SE_RULES. */
function rangeSystematicNce(tid,level){return globalThis.qcRangeCandidateService.systematicNce(tid,level);
  const matches=(state.actions||[]).filter(a=>a.testId===tid&&+a.level===+level&&!actionCancelled(a)&&String(a.rule||'').split(',').map(s=>s.trim()).some(r=>QCCore.WG_SE_RULES.includes(r)));
  if(!matches.length)return null;
  return matches.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
}
function rangeCandidate(tid,level){return globalThis.qcRangeCandidateService.candidate(tid,level);const t=state.tests.find(x=>x.id===tid),l=t&&lvlCfg(t,level);if(!t||!l)return{t,l,pts:[],wg:{F:[],zs:[]},c:null,days:0,bad:0,warn:0,eligible:false,nce:null};
  const pts=operationalLotPoints(t,level),allWG=activeWestgard(t),F=pts.map(p=>allWG.byPoint.get(p.id)||{level:'ok',rules:[]}),zs=pts.map(p=>QCCore.pointZ(p,l.mean,l.sd)),wg={F,zs},c=stats(pts.map(p=>p.val)),days=new Set(pts.map(p=>p.date)).size,bad=F.filter(f=>f.level==='rej').length,warn=F.filter(f=>f.level==='warn').length,eligible=!!(c&&c.n>=20&&days>=20&&bad===0&&warn===0&&c.sd>0),nce=rangeSystematicNce(tid,level);return{t,l,pts,wg,c,days,bad,warn,eligible,nce};}
function openRangeWorkflow(tid,level){
  const r=rangeCandidate(tid,level);if(!r.t||!r.l)return;
  const rows=[['Tổng số kết quả',r.c?r.c.n:0,'≥20',r.c&&r.c.n>=20],['Số ngày độc lập',r.days,'≥20 ngày',r.days>=20],['Điểm bị loại Westgard',r.bad,'Phải bằng 0; không tự loại điểm để làm đẹp SD',r.bad===0],['Điểm cảnh báo',r.warn,'Phải bằng 0 trước khi phê duyệt dải',r.warn===0],['SD đề xuất hợp lệ',r.c?fmtTestValue(r.t,r.c.sd):'—','>0',r.c&&r.c.sd>0]];
  const checklist=globalThis.rangeWorkflowChecklistRowsHtml(rows.map(x=>({condition:x[0],current:x[1],requirement:x[2],passed:x[3]})));
  const c=r.c;
  const nceNotice=r.nce?globalThis.rangeNceNoticeHtml({nceId:esc(r.nce.nceId||'NCE'),rule:esc(r.nce.rule||''),cause:esc((r.nce.cause||'').slice(0,200))}):'';
  const contextHtml=`<b>${esc(testDisplayName(r.t))}</b> · Mức ${level} · Lô ${esc(r.l.lot||'?')} · ${esc(r.t.machine||'')}`,comparisonRowsHtml=globalThis.rangeWorkflowComparisonRowsHtml({label:`Đang dùng (${r.l.applied==='lab'?'PXN':'NSX'})`,mean:fmtTestValue(r.t,r.l.mean),sd:fmtTestValue(r.t,r.l.sd),cv:fmt(r.l.mean?r.l.sd/Math.abs(r.l.mean)*100:0),limits:`${fmtTestValue(r.t,r.l.mean-2*r.l.sd)} – ${fmtTestValue(r.t,r.l.mean+2*r.l.sd)}`},c?{label:'Đề xuất PXN',mean:fmtTestValue(r.t,c.m),sd:fmtTestValue(r.t,c.sd),cv:fmt(c.cv),limits:`${fmtTestValue(r.t,c.m-2*c.sd)} – ${fmtTestValue(r.t,c.m+2*c.sd)}`,proposed:true}:null);
  openModal(globalThis.rangeWorkflowModalHtml({contextHtml,nceNoticeHtml:nceNotice,checklistRowsHtml:checklist,currentRangeRowHtml:comparisonRowsHtml,proposedRangeRowHtml:'',printButtonHtml:btn('In biểu mẫu',`printRangeForm('${tid}',${level})`,'ghost'),applyButtonHtml:canWrite()?btn('Áp dụng dải PXN',`closeModal();applyNewRange('${tid}',${level})`,'teal','',{disabled:!r.eligible}):'',closeButtonHtml:btn('Đóng','closeModal()','ghost')}));
}
/* TEa% của xét nghiệm tại đúng target=mean đang dùng, dùng chung cho ngưỡng Bias
   (điều kiện 2) và số tham khảo ΔSEcrit/ΔREcrit — lấy nguyên lớp giải TEa của
   trang Sigma (sigma-tea.js) thay vì dựng một bảng TEa riêng cho range.js. */
function rangeTeaPercent(t,l){return globalThis.qcRangeTea.percent(t,l);}
/* Khối xác nhận 2 điều kiện chỉ hiện khi rangeCandidate() thấy có hồ sơ NCE hệ
   thống (r.nce) — thiết lập dải thường quy (không có NCE liên quan) giữ nguyên
   luồng cũ, không thêm ma sát. */
function rangeGateHtml(r,tid,level){
  if(!r.nce)return'';
  const tea=rangeTeaPercent(r.t,r.l),threshold=globalThis.qcRangeTea.quarter(tea);
  return globalThis.rangeSafetyGateHtml({nceId:esc(r.nce.nceId||'NCE'),rule:esc(r.nce.rule||''),biasInputAction:`rangeUpdateBiasHint('${tid}',${level})`,thresholdText:threshold!=null?fmt(threshold)+'%':'—',noTeaHint:tea?'':'Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung, hoặc vẫn có thể xác nhận thủ công nếu ngưỡng đã biết theo cách khác.'});
}
/* Cập nhật khi gõ Bias: kết luận đạt/vượt ngưỡng TEa/4, và số THAM KHẢO
   ΔSEcrit/ΔREcrit (systematicShiftCritical trong core.js) — không phải kết luận
   nguy cơ chính thức, không có mức thấp/cao tự động như mục 2/8 của hồ sơ NCE. */
function rangeUpdateBiasHint(tid,level){
  const r=rangeCandidate(tid,level),biasEl=document.getElementById('rangeBiasInput'),hint=document.getElementById('rangeBiasHint');
  if(!r.nce||!biasEl||!hint)return;
  const bias=parseFloat(String(biasEl.value).replace(',','.')),tea=rangeTeaPercent(r.t,r.l);
  if(!tea){hint.textContent='Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung.';return;}
  if(!Number.isFinite(bias)){hint.textContent='';return;}
  const result=globalThis.qcRangeBiasEvaluation(tea,bias,r.l.sd,QCCore.systematicShiftCritical);
  hint.innerHTML=`${result.withinThreshold?'✔ Đạt':'✘ Vượt'} ngưỡng: |Bias| ${fmt(Math.abs(bias))}% so với ${fmt(result.threshold)}%.`+(result.critical?` <span style="color:var(--muted)">Tham khảo (không phải kết luận chính thức): ΔSEcrit ${fmt(result.critical.dSEcrit)} · ΔREcrit ${fmt(result.critical.dREcrit)}.</span>`:'');
}
function rangeGatePasses(r){
  if(!r.nce)return true;
  const causeEl=document.getElementById('rangeCauseConfirm'),biasEl=document.getElementById('rangeBiasInput'),bias=parseFloat(String(biasEl?biasEl.value:'').replace(',','.')),tea=rangeTeaPercent(r.t,r.l);
  return globalThis.qcRangeSafetyGate(r.nce,tea,!!(causeEl&&causeEl.checked),bias).passes;
  return!!(causeEl&&causeEl.checked&&tea&&Number.isFinite(bias)&&Math.abs(bias)<=tea/4);
}
async function applyNewRange(tid,level){
  if(!requireWrite())return;
  const r=rangeCandidate(tid,level),{t,l,c,days,bad,warn,eligible}=r;
  if(!eligible){await infoDialog(`Chưa đủ điều kiện: cần ≥20 kết quả trên ≥20 ngày, không có điểm vi phạm/cảnh báo chưa xử lý và SD >0.\nHiện tại: n=${c?c.n:0}, ngày=${days}, điểm loại=${bad}, điểm cảnh báo=${warn}.`);return;}
  openModal(globalThis.rangeApplyConfirmationModalHtml({changeSummaryHtml:`X̄: ${fmtTestValue(t,l.mean)} → ${fmtTestValue(t,c.m)}<br>SD: ${fmtTestStat(t,l.sd)} → ${fmtTestStat(t,c.sd)}<br>Dải nhà sản xuất vẫn được lưu để hoàn về.`,gateHtml:rangeGateHtml(r,tid,level),cancelButtonHtml:btn('Hủy','closeModal()','ghost'),applyButtonHtml:btn('Áp dụng',`confirmApplyNewRange('${tid}',${level})`,'teal')}));
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
}
async function confirmApplyNewRange(tid,level){
  const r=rangeCandidate(tid,level),{t,l,c,days,nce}=r;
  if(!rangeGatePasses(r)){const err=document.getElementById('rangeGateErr');if(err)err.style.display='';return;}
  const input=document.getElementById('rangeReasonInput');
  const reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<10){const err=document.getElementById('rangeReasonErr');if(err)err.style.display='';return;}
  closeModal();if(!await reauthenticateCurrentUser({title:'Xác thực thay đổi dải QC',message:'Nhập lại mật khẩu trước khi áp dụng Mean/SD của phòng xét nghiệm.'}))return;
  const oldM=l.mean,oldSd=l.sd;
  const gateNote=nce?` Điều kiện dịch chuyển hệ thống: đã xác nhận nguyên nhân theo hồ sơ NCE ${nce.nceId||nce.id}, Bias đo lại trong ngưỡng cho phép (≤ TEa/4).`:'';
  const detail=`M${level}: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,c.m)}, SD ${fmtTestStat(t,oldSd)}→${fmtTestStat(t,c.sd)}`;
  const actionText=`Áp dụng dải PXN: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,c.m)}, SD ${fmtTestStat(t,oldSd)}→${fmtTestStat(t,c.sd)}, n=${c.n}, ${days} ngày. Phê duyệt: ${reason}${gateNote}`;
  const result=globalThis.RangeWorkflowCommand.applyLab({level:l,testId:tid,levelNo:level,lot:l.lot||'',testName:t?t.name:'',mean:c.m,sd:c.sd,cv:c.cv,reason,gateNote,detail,actionText,historyId:uid(),actionId:uid(),today:isoToday(),createdAt:new Date().toISOString(),userId:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',userName:currentUser?(currentUser.name||currentUser.username):''});
  if(!result.ok){await infoDialog(result.message);return;}
}
function revertRange(tid,level){
  if(!requireWrite())return;
  openModal(globalThis.rangeRevertConfirmationModalHtml({cancelButtonHtml:btn('Hủy','closeModal()','ghost'),revertButtonHtml:btn('Hoàn về dải NSX',`confirmRevertRange('${tid}',${level})`,'danger')}));
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
}
async function confirmRevertRange(tid,level){
  const t=state.tests.find(x=>x.id===tid);const l=lvlCfg(t,level);
  const input=document.getElementById('rangeReasonInput');
  const reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<5){const err=document.getElementById('rangeReasonErr');if(err)err.style.display='';return;}
  closeModal();if(!await reauthenticateCurrentUser({title:'Xác thực hoàn dải QC',message:'Nhập lại mật khẩu trước khi hoàn về Mean/SD nhà sản xuất.'}))return;
  const oldM=l.mean,oldSd=l.sd;
  const detail=`M${level}: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,l.mfgMean)}, SD ${fmtTestValue(t,oldSd)}→${fmtTestValue(t,l.mfgSd)} · ${reason}`;
  const actionText=`Hoàn về dải NSX: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,l.mfgMean)}, SD ${fmtTestValue(t,oldSd)}→${fmtTestValue(t,l.mfgSd)}. Lý do: ${reason}`;
  const result=globalThis.RangeWorkflowCommand.revertMfg({level:l,testId:tid,levelNo:level,lot:l.lot||'',testName:t?t.name:'',reason,detail,actionText,historyId:uid(),actionId:uid(),today:isoToday(),createdAt:new Date().toISOString(),userId:currentUser&&currentUser.id||'',username:currentUser&&currentUser.username||'',userName:currentUser?(currentUser.name||currentUser.username):''});
  if(!result.ok){await infoDialog(result.message);return;}
}


