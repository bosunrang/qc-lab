/* ===== NEW QC RANGE ===== */
function rangeCandidate(tid,level){const t=state.tests.find(x=>x.id===tid),l=lvlCfg(t,level),pts=operationalLotPoints(t,level),allWG=activeWestgard(t),F=pts.map(p=>allWG.byPoint.get(p.id)||{level:'ok',rules:[]}),zs=pts.map(p=>QCCore.pointZ(p,l.mean,l.sd)),wg={F,zs},c=stats(pts.map(p=>p.val)),days=new Set(pts.map(p=>p.date)).size,bad=F.filter(f=>f.level==='rej').length,warn=F.filter(f=>f.level==='warn').length,eligible=!!(c&&c.n>=20&&days>=20&&bad===0&&warn===0&&c.sd>0);return{t,l,pts,wg,c,days,bad,warn,eligible};}
function openRangeWorkflow(tid,level){
  const r=rangeCandidate(tid,level);if(!r.t||!r.l)return;
  const rows=[['Tổng số kết quả',r.c?r.c.n:0,'≥20',r.c&&r.c.n>=20],['Số ngày độc lập',r.days,'≥20 ngày',r.days>=20],['Điểm bị loại Westgard',r.bad,'Phải bằng 0; không tự loại điểm để làm đẹp SD',r.bad===0],['Điểm cảnh báo',r.warn,'Phải bằng 0 trước khi phê duyệt dải',r.warn===0],['SD đề xuất hợp lệ',r.c?fmt(r.c.sd,3):'—','>0',r.c&&r.c.sd>0]];
  const checklist=rows.map(x=>`<tr><td>${x[0]}</td><td class="num">${x[1]}</td><td>${x[2]}</td><td><span class="tag ${x[3]?'ok':'rej'}">${x[3]?'Đạt':'Chưa đạt'}</span></td></tr>`).join('');
  const c=r.c;
  openModal(`<div class="modal" style="width:760px"><div class="modal-h"><h3>Workflow thiết lập dải QC mới</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b"><div class="hint"><b>${esc(testDisplayName(r.t))}</b> · Mức ${level} · Lô ${esc(r.l.lot||'?')} · ${esc(r.t.machine||'')}</div>
      <table style="margin-top:10px"><thead><tr><th>Điều kiện</th><th class="num">Hiện tại</th><th>Chuẩn kiểm tra</th><th>Kết quả</th></tr></thead><tbody>${checklist}</tbody></table>
      <h3 style="margin:16px 0 8px">So sánh dải kiểm soát</h3>
      <table><thead><tr><th>Dải</th><th class="num">Mean</th><th class="num">SD</th><th class="num">CV%</th><th class="num">±2SD</th></tr></thead><tbody>
        <tr><td>Đang dùng (${r.l.applied==='lab'?'PXN':'NSX'})</td><td class="num">${fmt(r.l.mean)}</td><td class="num">${fmt(r.l.sd,3)}</td><td class="num">${fmt(r.l.mean?r.l.sd/Math.abs(r.l.mean)*100:0)}</td><td class="num">${fmt(r.l.mean-2*r.l.sd)} – ${fmt(r.l.mean+2*r.l.sd)}</td></tr>
        ${c?`<tr><td><b>Đề xuất PXN</b></td><td class="num"><b>${fmt(c.m)}</b></td><td class="num"><b>${fmt(c.sd,3)}</b></td><td class="num"><b>${fmt(c.cv)}</b></td><td class="num"><b>${fmt(c.m-2*c.sd)} – ${fmt(c.m+2*c.sd)}</b></td></tr>`:''}
      </tbody></table>
      <div class="alert info" style="margin-top:12px">Mean/SD được tính từ toàn bộ tập dữ liệu đã chọn. Không tự loại điểm vi phạm để làm giảm SD. Chỉ áp dụng khi cùng lô QC, tối thiểu 20 ngày độc lập, quá trình ổn định và có phê duyệt theo SOP.</div></div>
    <div class="modal-f">${btn('In biểu mẫu',`printRangeForm('${tid}',${level})`,'ghost')}${canWrite()?btn('Áp dụng dải PXN',`closeModal();applyNewRange('${tid}',${level})`,'teal','',{disabled:!r.eligible}):''}${btn('Đóng','closeModal()','ghost')}</div></div>`);
}
async function applyNewRange(tid,level){
  if(!requireWrite())return;
  const {t,l,c,days,bad,warn,eligible}=rangeCandidate(tid,level);
  if(!eligible){await infoDialog(`Chưa đủ điều kiện: cần ≥20 kết quả trên ≥20 ngày, không có điểm vi phạm/cảnh báo chưa xử lý và SD >0.\nHiện tại: n=${c?c.n:0}, ngày=${days}, điểm loại=${bad}, điểm cảnh báo=${warn}.`);return;}
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Áp dụng dải PXN mới?</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <div class="hint">X̄: ${fmt(l.mean)} → ${fmt(c.m)}<br>SD: ${fmt(l.sd,3)} → ${fmt(c.sd,3)}<br>Dải nhà sản xuất vẫn được lưu để hoàn về.</div>
      <label style="margin-top:10px">Căn cứ/phê duyệt (SOP, người duyệt hoặc biên bản — tối thiểu 10 ký tự)</label>
      <textarea id="rangeReasonInput" placeholder="VD: Theo SOP-XXX, phê duyệt bởi..." oninput="document.getElementById('rangeReasonErr').style.display='none'"></textarea>
      <div id="rangeReasonErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần ghi căn cứ phê duyệt tối thiểu 10 ký tự.</div>
    </div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Áp dụng',`confirmApplyNewRange('${tid}',${level})`,'teal')}</div>
  </div>`);
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
}
function confirmApplyNewRange(tid,level){
  const {t,l,c,days}=rangeCandidate(tid,level);
  const input=document.getElementById('rangeReasonInput');
  const reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<10){const err=document.getElementById('rangeReasonErr');if(err)err.style.display='';return;}
  closeModal();
  const oldM=l.mean,oldSd=l.sd;l.mean=c.m;l.sd=c.sd;l.cvRef=c.cv;l.applied='lab';l.rangeDate=isoToday();
  l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];
  l.meanSdHistory.push({id:uid(),qcLotId:l.qcLotId||'',lot:l.lot||'',mean:c.m,sd:c.sd,low:c.m-2*c.sd,high:c.m+2*c.sd,effectiveFrom:isoToday(),effectiveTo:l.exp||'',source:'lab',note:reason});
  state.actions.push({id:uid(),date:isoToday(),createdAt:new Date().toISOString(),testId:tid,level,lot:l.lot||'',rule:'Thiết lập dải QC mới',errorType:'Quản lý dải kiểm soát',action:`Áp dụng dải PXN: Mean ${fmt(oldM)}→${fmt(c.m)}, SD ${fmt(oldSd,3)}→${fmt(c.sd,3)}, n=${c.n}, ${days} ngày. Phê duyệt: ${reason}`,by:currentUser?(currentUser.name||currentUser.username):'',approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});
  logAct('Áp dụng dải QC',`M${level}: Mean ${fmt(oldM)}→${fmt(c.m)}, SD ${fmt(oldSd,3)}→${fmt(c.sd,3)}`,t?t.name:'');
  save({testId:tid});rerender();
}
function revertRange(tid,level){
  if(!requireWrite())return;
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Hoàn về dải nhà sản xuất?</h3><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-b">
      <label>Lý do/căn cứ hoàn về dải nhà sản xuất (tối thiểu 5 ký tự)</label>
      <textarea id="rangeReasonInput" placeholder="VD: Dải PXN không còn phù hợp, hoàn theo yêu cầu..." oninput="document.getElementById('rangeReasonErr').style.display='none'"></textarea>
      <div id="rangeReasonErr" class="hint" style="color:var(--red);display:none;margin-top:6px">Cần ghi lý do tối thiểu 5 ký tự.</div>
    </div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Hoàn về dải NSX',`confirmRevertRange('${tid}',${level})`,'danger')}</div>
  </div>`);
  setTimeout(()=>{const e=document.getElementById('rangeReasonInput');if(e)e.focus();},50);
}
function confirmRevertRange(tid,level){
  const t=state.tests.find(x=>x.id===tid);const l=lvlCfg(t,level);
  const input=document.getElementById('rangeReasonInput');
  const reason=QCCore.cleanText(input?input.value:'',1000).trim();
  if(reason.length<5){const err=document.getElementById('rangeReasonErr');if(err)err.style.display='';return;}
  closeModal();
  const oldM=l.mean,oldSd=l.sd;l.mean=l.mfgMean;l.sd=l.mfgSd;l.applied='mfg';l.meanSdHistory=Array.isArray(l.meanSdHistory)?l.meanSdHistory:[];l.meanSdHistory.push({id:uid(),qcLotId:l.qcLotId||'',lot:l.lot||'',mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:isoToday(),effectiveTo:l.exp||'',source:'mfg',note:reason});state.actions.push({id:uid(),date:isoToday(),createdAt:new Date().toISOString(),testId:tid,level,lot:l.lot||'',rule:'Hoàn dải QC',errorType:'Quản lý dải kiểm soát',action:`Hoàn về dải NSX: Mean ${fmt(oldM)}→${fmt(l.mean)}, SD ${fmt(oldSd,3)}→${fmt(l.sd,3)}. Lý do: ${reason}`,by:currentUser?(currentUser.name||currentUser.username):'',approvalStatus:'pending',approvedAt:'',approvedBy:'',approvalNote:''});logAct('Hoàn dải QC',`M${level}: Mean ${fmt(oldM)}→${fmt(l.mean)}, SD ${fmt(oldSd,3)}→${fmt(l.sd,3)} · ${reason}`,t?t.name:'');save({testId:tid});rerender();
}


