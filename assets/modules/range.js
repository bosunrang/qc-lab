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
function rangeSystematicNce(tid,level){
  const matches=(state.actions||[]).filter(a=>a.testId===tid&&+a.level===+level&&!actionCancelled(a)&&String(a.rule||'').split(',').map(s=>s.trim()).some(r=>QCCore.WG_SE_RULES.includes(r)));
  if(!matches.length)return null;
  return matches.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
}
function rangeCandidate(tid,level){const t=state.tests.find(x=>x.id===tid),l=t&&lvlCfg(t,level);if(!t||!l)return{t,l,pts:[],wg:{F:[],zs:[]},c:null,days:0,bad:0,warn:0,eligible:false,nce:null};
  const pts=operationalLotPoints(t,level),allWG=activeWestgard(t),F=pts.map(p=>allWG.byPoint.get(p.id)||{level:'ok',rules:[]}),zs=pts.map(p=>QCCore.pointZ(p,l.mean,l.sd)),wg={F,zs},c=stats(pts.map(p=>p.val)),days=new Set(pts.map(p=>p.date)).size,bad=F.filter(f=>f.level==='rej').length,warn=F.filter(f=>f.level==='warn').length,eligible=!!(c&&c.n>=20&&days>=20&&bad===0&&warn===0&&c.sd>0),nce=rangeSystematicNce(tid,level);return{t,l,pts,wg,c,days,bad,warn,eligible,nce};}
function assignRangeTarget(levelCfg,mean,sd,source){const next=QCCore.limitsFromTarget(mean,sd,2);if(!levelCfg||!next)return false;Object.assign(levelCfg,{mean:next.mean,sd:next.sd,low:next.low,high:next.high,rangeK:2,applied:source});return true;}
function openRangeWorkflow(tid,level){
  const r=rangeCandidate(tid,level);if(!r.t||!r.l)return;
  const rows=[['Tổng số kết quả',r.c?r.c.n:0,'≥20',r.c&&r.c.n>=20],['Số ngày độc lập',r.days,'≥20 ngày',r.days>=20],['Điểm bị loại Westgard',r.bad,'Phải bằng 0; không tự loại điểm để làm đẹp SD',r.bad===0],['Điểm cảnh báo',r.warn,'Phải bằng 0 trước khi phê duyệt dải',r.warn===0],['SD đề xuất hợp lệ',r.c?fmtTestValue(r.t,r.c.sd):'—','>0',r.c&&r.c.sd>0]];
  const checklist=rows.map(x=>`<tr><td>${x[0]}</td><td class="num">${x[1]}</td><td>${x[2]}</td><td><span class="tag ${x[3]?'ok':'rej'}">${x[3]?'Đạt':'Chưa đạt'}</span></td></tr>`).join('');
  const c=r.c;
  const nceNotice=r.nce?`<div class="alert warn flow-control"><b>Đang có hồ sơ NCE ${esc(r.nce.nceId||'NCE')} ghi nhận vi phạm hệ thống (${esc(r.nce.rule||'')})</b><div>${esc((r.nce.cause||'').slice(0,200))||'Chưa ghi nguyên nhân trong hồ sơ.'}</div></div>`:'';
  openModal(`<div class="modal range-workflow-modal"><div class="modal-h"><h3>Workflow thiết lập dải QC mới</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><div class="hint"><b>${esc(testDisplayName(r.t))}</b> · Mức ${level} · Lô ${esc(r.l.lot||'?')} · ${esc(r.t.machine||'')}</div>${nceNotice}
      <table class="range-workflow-checklist"><colgroup><col><col><col><col></colgroup><thead><tr><th>Điều kiện</th><th>Hiện tại</th><th>Chuẩn kiểm tra</th><th>Kết quả</th></tr></thead><tbody>${checklist}</tbody></table>
      <h3 style="margin:16px 0 8px">So sánh dải kiểm soát</h3>
      <table class="range-workflow-comparison"><colgroup><col><col><col><col><col></colgroup><thead><tr><th>Dải</th><th>Mean</th><th>SD</th><th>CV%</th><th>±2SD</th></tr></thead><tbody>
        <tr><td>Đang dùng (${r.l.applied==='lab'?'PXN':'NSX'})</td><td class="num">${fmtTestValue(r.t,r.l.mean)}</td><td class="num">${fmtTestValue(r.t,r.l.sd)}</td><td class="num">${fmt(r.l.mean?r.l.sd/Math.abs(r.l.mean)*100:0)}</td><td class="num">${fmtTestValue(r.t,r.l.mean-2*r.l.sd)} – ${fmtTestValue(r.t,r.l.mean+2*r.l.sd)}</td></tr>
        ${c?`<tr><td><b>Đề xuất PXN</b></td><td class="num"><b>${fmtTestValue(r.t,c.m)}</b></td><td class="num"><b>${fmtTestValue(r.t,c.sd)}</b></td><td class="num"><b>${fmt(c.cv)}</b></td><td class="num"><b>${fmtTestValue(r.t,c.m-2*c.sd)} – ${fmtTestValue(r.t,c.m+2*c.sd)}</b></td></tr>`:''}
      </tbody></table>
      <div class="alert info flow-section">Mean/SD được tính từ toàn bộ tập dữ liệu đã chọn. Không tự loại điểm vi phạm để làm giảm SD. Chỉ áp dụng khi cùng lô QC, tối thiểu 20 ngày độc lập, quá trình ổn định và có phê duyệt theo SOP.</div></div>
    <div class="modal-f">${btn('In biểu mẫu',`printRangeForm('${tid}',${level})`,'ghost')}${canWrite()?btn('Áp dụng dải PXN',`closeModal();applyNewRange('${tid}',${level})`,'teal','',{disabled:!r.eligible}):''}${btn('Đóng','closeModal()','ghost')}</div></div>`);
}
/* TEa% của xét nghiệm tại đúng target=mean đang dùng, dùng chung cho ngưỡng Bias
   (điều kiện 2) và số tham khảo ΔSEcrit/ΔREcrit — lấy nguyên lớp giải TEa của
   trang Sigma (sigma-tea.js) thay vì dựng một bảng TEa riêng cho range.js. */
function rangeTeaPercent(t,l){const v=t?sgTeaBySource(t,sgTeaSource(t),l.mean):0;return Number.isFinite(v)&&v>0?v:null;}
/* Khối xác nhận 2 điều kiện chỉ hiện khi rangeCandidate() thấy có hồ sơ NCE hệ
   thống (r.nce) — thiết lập dải thường quy (không có NCE liên quan) giữ nguyên
   luồng cũ, không thêm ma sát. */
function rangeGateHtml(r,tid,level){
  if(!r.nce)return'';
  const tea=rangeTeaPercent(r.t,r.l),threshold=tea?tea/4:null;
  return `<div class="alert warn flow-control"><b>Hồ sơ NCE ${esc(r.nce.nceId||'NCE')} đang ghi nhận vi phạm hệ thống (${esc(r.nce.rule||'')})</b><div>Xác nhận 2 điều kiện dưới đây trước khi áp dụng dải mới — tránh "đuổi theo mean" khi nguyên nhân dịch chuyển chưa được lý giải.</div></div>
    <label class="range-gate-check"><input type="checkbox" id="rangeCauseConfirm" onchange="document.getElementById('rangeGateErr').style.display='none'"><span>Xác nhận nguyên nhân dịch chuyển đã được xác định và ghi nhận trong hồ sơ NCE ${esc(r.nce.nceId||'NCE')} (không phải lỗi chưa lý giải)</span></label>
    <div class="field-row flow-item"><div><label>Bias đo lại (%)</label><input id="rangeBiasInput" type="text" inputmode="decimal" oninput="rangeUpdateBiasHint('${tid}',${level})"></div><div><label>Ngưỡng cho phép (≤ TEa/4)</label><input id="rangeBiasThreshold" readonly value="${threshold!=null?fmt(threshold)+'%':'—'}"></div></div>
    <div id="rangeBiasHint" class="hint flow-tight">${tea?'':'Chưa có TEa% cho xét nghiệm này — vào Cấu hình Sigma để bổ sung, hoặc vẫn có thể xác nhận thủ công nếu ngưỡng đã biết theo cách khác.'}</div>
    <div id="rangeGateErr" class="hint field-error">Cần xác nhận nguyên nhân dịch chuyển và nhập Bias trong ngưỡng cho phép trước khi áp dụng.</div>`;
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
  const threshold=tea/4,ok=Math.abs(bias)<=threshold,crit=QCCore.systematicShiftCritical(tea,bias,r.l.sd);
  hint.innerHTML=`${ok?'✔ Đạt':'✘ Vượt'} ngưỡng: |Bias| ${fmt(Math.abs(bias))}% so với ${fmt(threshold)}%.`+(crit?` <span style="color:var(--muted)">Tham khảo (không phải kết luận chính thức): ΔSEcrit ${fmt(crit.dSEcrit)} · ΔREcrit ${fmt(crit.dREcrit)}.</span>`:'');
}
function rangeGatePasses(r){
  if(!r.nce)return true;
  const causeEl=document.getElementById('rangeCauseConfirm'),biasEl=document.getElementById('rangeBiasInput'),bias=parseFloat(String(biasEl?biasEl.value:'').replace(',','.')),tea=rangeTeaPercent(r.t,r.l);
  return!!(causeEl&&causeEl.checked&&tea&&Number.isFinite(bias)&&Math.abs(bias)<=tea/4);
}
async function applyNewRange(tid,level){
  if(!requireWrite())return;
  const r=rangeCandidate(tid,level),{t,l,c,days,bad,warn,eligible}=r;
  if(!eligible){await infoDialog(`Chưa đủ điều kiện: cần ≥20 kết quả trên ≥20 ngày, không có điểm vi phạm/cảnh báo chưa xử lý và SD >0.\nHiện tại: n=${c?c.n:0}, ngày=${days}, điểm loại=${bad}, điểm cảnh báo=${warn}.`);return;}
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Áp dụng dải PXN mới?</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <div class="hint">X̄: ${fmtTestValue(t,l.mean)} → ${fmtTestValue(t,c.m)}<br>SD: ${fmtTestStat(t,l.sd)} → ${fmtTestStat(t,c.sd)}<br>Dải nhà sản xuất vẫn được lưu để hoàn về.</div>
      ${rangeGateHtml(r,tid,level)}
      <label class="flow-control">Căn cứ/phê duyệt (SOP, người duyệt hoặc biên bản — tối thiểu 10 ký tự)</label>
      <textarea id="rangeReasonInput" placeholder="VD: Theo SOP-XXX, phê duyệt bởi..." oninput="document.getElementById('rangeReasonErr').style.display='none'"></textarea>
      <div id="rangeReasonErr" class="hint field-error">Cần ghi căn cứ phê duyệt tối thiểu 10 ký tự.</div>
    </div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Áp dụng',`confirmApplyNewRange('${tid}',${level})`,'teal')}</div>
  </div>`);
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
}
async function confirmApplyNewRange(tid,level){
  const r=rangeCandidate(tid,level),{t,l,c,days,nce}=r;
  if(!rangeGatePasses(r)){const err=document.getElementById('rangeGateErr');if(err)err.style.display='';return;}
  const input=document.getElementById('rangeReasonInput');
  const reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<10){const err=document.getElementById('rangeReasonErr');if(err)err.style.display='';return;}
  closeModal();if(!await reauthenticateCurrentUser({title:'Xác thực thay đổi dải QC',message:'Nhập lại mật khẩu trước khi áp dụng Mean/SD của phòng xét nghiệm.'}))return;
  const oldM=l.mean,oldSd=l.sd;assignRangeTarget(l,c.m,c.sd,'lab');l.cvRef=c.cv;l.rangeDate=isoToday();
  l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];
  const gateNote=nce?` Điều kiện dịch chuyển hệ thống: đã xác nhận nguyên nhân theo hồ sơ NCE ${nce.nceId||nce.id}, Bias đo lại trong ngưỡng cho phép (≤ TEa/4).`:'';
  l.meanSdHistory.push({id:uid(),qcLotId:l.qcLotId||'',lot:l.lot||'',mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:isoToday(),effectiveTo:l.exp||'',source:'lab',note:reason+gateNote});
  state.actions.push({id:uid(),date:isoToday(),createdAt:new Date().toISOString(),createdByUserId:currentUser&&currentUser.id||'',createdByUsername:currentUser&&currentUser.username||'',testId:tid,level,lot:l.lot||'',rule:'Thiết lập dải QC mới',errorType:'Quản lý dải kiểm soát',action:`Áp dụng dải PXN: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,c.m)}, SD ${fmtTestStat(t,oldSd)}→${fmtTestStat(t,c.sd)}, n=${c.n}, ${days} ngày. Phê duyệt: ${reason}${gateNote}`,by:currentUser?(currentUser.name||currentUser.username):'',approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});
  logAct('Áp dụng dải QC',`M${level}: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,c.m)}, SD ${fmtTestStat(t,oldSd)}→${fmtTestStat(t,c.sd)}`,t?t.name:'');
  save({testId:tid});rerender();
}
function revertRange(tid,level){
  if(!requireWrite())return;
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Hoàn về dải nhà sản xuất?</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <label>Lý do/căn cứ hoàn về dải nhà sản xuất (tối thiểu 5 ký tự)</label>
      <textarea id="rangeReasonInput" placeholder="VD: Dải PXN không còn phù hợp, hoàn theo yêu cầu..." oninput="document.getElementById('rangeReasonErr').style.display='none'"></textarea>
      <div id="rangeReasonErr" class="hint field-error">Cần ghi lý do tối thiểu 5 ký tự.</div>
    </div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Hoàn về dải NSX',`confirmRevertRange('${tid}',${level})`,'danger')}</div>
  </div>`);
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
}
async function confirmRevertRange(tid,level){
  const t=state.tests.find(x=>x.id===tid);const l=lvlCfg(t,level);
  const input=document.getElementById('rangeReasonInput');
  const reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<5){const err=document.getElementById('rangeReasonErr');if(err)err.style.display='';return;}
  closeModal();if(!await reauthenticateCurrentUser({title:'Xác thực hoàn dải QC',message:'Nhập lại mật khẩu trước khi hoàn về Mean/SD nhà sản xuất.'}))return;
  const oldM=l.mean,oldSd=l.sd;if(!assignRangeTarget(l,l.mfgMean,l.mfgSd,'mfg')){await infoDialog('Không tìm thấy Mean/SD nhà sản xuất hợp lệ để hoàn về.');return;}l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];l.meanSdHistory.push({id:uid(),qcLotId:l.qcLotId||'',lot:l.lot||'',mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:isoToday(),effectiveTo:l.exp||'',source:'mfg',note:reason});state.actions.push({id:uid(),date:isoToday(),createdAt:new Date().toISOString(),createdByUserId:currentUser&&currentUser.id||'',createdByUsername:currentUser&&currentUser.username||'',testId:tid,level,lot:l.lot||'',rule:'Hoàn dải QC',errorType:'Quản lý dải kiểm soát',action:`Hoàn về dải NSX: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,l.mean)}, SD ${fmtTestValue(t,oldSd)}→${fmtTestValue(t,l.sd)}. Lý do: ${reason}`,by:currentUser?(currentUser.name||currentUser.username):'',approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});logAct('Hoàn dải QC',`M${level}: Mean ${fmtTestValue(t,oldM)}→${fmtTestValue(t,l.mean)}, SD ${fmtTestValue(t,oldSd)}→${fmtTestValue(t,l.sd)} · ${reason}`,t?t.name:'');save({testId:tid});rerender();
}


