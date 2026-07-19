/* ===== ENTRY / TESTS / ACTIONS ===== */
function validIsoDate(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||''));if(!m)return'';const y=+m[1],mo=+m[2],d=+m[3],dt=new Date(Date.UTC(y,mo-1,d));return y>=1000&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?s:'';}
function parseVN(s){if(!s)return '';s=String(s).trim();const m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(s);if(m)return validIsoDate(m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'));if(/^\d{4}-\d{2}-\d{2}$/.test(s))return validIsoDate(s);return '';}
function setManageTab(tab){manageTab=['lots','panels','targets','history','transitions','assays','instruments','tearefs'].includes(tab)?tab:'instruments';manageQ='';rerender();resetMainScroll();}
function setTargetPanel(id){manageTargetPanel=id;rerender();}
function setTargetGroup(id){manageTargetGroup=id;rerender();}
function setTargetLevel(level){manageTargetLevel=String(level||'');rerender();}
function setHistoryTest(id){manageHistoryTest=id;rerender();}
function openTargetMatrix(panelId='',groupId=''){if(panelId)manageTargetPanel=panelId;if(groupId)manageTargetGroup=groupId;setManageTab('targets');}
function targetNumberText(value){return value!=null&&String(value).trim()!==''&&Number.isFinite(Number(value))?String(Number(Number(value).toPrecision(12))):'';}
function targetConfigAssigned(cfg){
  return !!(cfg&&(cfg.qcLotId||cfg.lot||(Array.isArray(cfg.meanSdHistory)&&cfg.meanSdHistory.length)));
}
function targetRangeDraft(cfg={}){
  let mean=cfg.mean==null?null:Number(cfg.mean),sd=cfg.sd==null?null:Number(cfg.sd),low=cfg.low==null?null:Number(cfg.low),high=cfg.high==null?null:Number(cfg.high);
  const fromLimits=QCCore.targetFromLimits(low,high);
  if(fromLimits){if(!Number.isFinite(mean))mean=fromLimits.mean;if(!Number.isFinite(sd)||sd<=0)sd=fromLimits.sd;}
  const fromTarget=QCCore.limitsFromTarget(mean,sd);
  if(fromTarget){if(!Number.isFinite(low))low=fromTarget.low;if(!Number.isFinite(high))high=fromTarget.high;}
  return{mean,sd,low,high};
}
function syncTargetRange(el,source){
  const row=el.closest('.target-row');if(!row)return;
  const get=selector=>{const value=row.querySelector(selector).value.trim();return value===''?NaN:Number(value);};
  const result=source==='limits'?QCCore.targetFromLimits(get('.tm-low'),get('.tm-high')):QCCore.limitsFromTarget(get('.tm-mean'),get('.tm-sd'));
  if(!result)return;
  if(source==='limits'){row.querySelector('.tm-mean').value=targetNumberText(result.mean);row.querySelector('.tm-sd').value=targetNumberText(result.sd);}
  else{row.querySelector('.tm-low').value=targetNumberText(result.low);row.querySelector('.tm-high').value=targetNumberText(result.high);}
}
function toggleTargetRow(el){const row=el.closest('.target-row');row.querySelectorAll('.tm-mean,.tm-low,.tm-high,.tm-sd').forEach(x=>x.disabled=!el.checked);if(el.checked){const mean=row.querySelector('.tm-mean');if(!mean.value)mean.focus();}}
function targetCheckAll(on){document.querySelectorAll('.tm-use').forEach(box=>{box.checked=!!on;toggleTargetRow(box);});}
/* Áp 1 dòng Mean/SD (đã đọc/kiểm tra từ form) vào state cho đúng lô đang chọn.
   Nếu mức này trước đó đang gắn với MỘT LÔ KHÁC (một nhóm lô song song khác),
   chụp lại Mean/SD của lô cũ vào meanSdHistory trước khi ghi đè — nếu không, dữ
   liệu của lô cũ sẽ mất khi người dùng chuyển qua lại giữa các nhóm lô. Tách
   riêng khỏi saveTargetMatrix() (chỉ đọc DOM) để có thể kiểm thử độc lập. */
function applyTargetPick(t,lot,pick,effectiveFrom,note){
  const linked=t.levels.find(x=>x.qcLotId===lot.id);
  if(!pick.use){if(linked){linked.qcLotId='';linked.lot='';linked.exp='';return true;}return false;}
  const effectiveTo=lot.exp||'';
  let target=linked||t.levels.find(x=>+x.level===+lot.level);
  if(!target){target={level:lot.level,mean:pick.mean,sd:pick.sd,low:pick.low,high:pick.high,rangeK:2,mfgMean:pick.mean,mfgSd:pick.sd,applied:'mfg'};t.levels.push(target);t.levels.sort((a,b)=>a.level-b.level);}
  target.meanSdHistory=Array.isArray(target.meanSdHistory)?target.meanSdHistory:[];
  if(target.qcLotId&&target.qcLotId!==lot.id){
    const oldLot=state.qcLots.find(l=>l.id===target.qcLotId)||{id:target.qcLotId,lotNo:target.lot||''};
    if(Number.isFinite(+target.mean)&&Number.isFinite(+target.sd)&&+target.sd>0)upsertLotTargetHistory(target,oldLot,{mean:+target.mean,sd:+target.sd,low:target.low==null?null:+target.low,high:target.high==null?null:+target.high,effectiveFrom:(target.meanSdHistory||[]).find(h=>h.qcLotId===oldLot.id)?.effectiveFrom||'',effectiveTo:effectiveFrom,source:target.applied||'mfg',planned:false,note:'Trước khi đổi sang lô khác qua Mean/SD theo nhóm'});
  }
  if(target.lot&&target.lot!==lot.lotNo)(state.data[t.id]||[]).filter(p=>p.level===target.level&&(p.lot==null||p.lot===target.lot)).forEach(p=>{p.lot=target.lot;p.qcMean=p.qcMean==null?target.mean:p.qcMean;p.qcSd=p.qcSd==null?target.sd:p.qcSd;});
  upsertLotTargetHistory(target,lot,{mean:pick.mean,sd:pick.sd,low:pick.low,high:pick.high,effectiveFrom,effectiveTo,source:'mfg',planned:false,note});
  Object.assign(target,{level:lot.level,qcLotId:lot.id,lot:lot.lotNo,exp:lot.exp,mean:pick.mean,sd:pick.sd,low:pick.low,high:pick.high,rangeK:2,mfgMean:pick.mean,mfgSd:pick.sd,applied:'mfg'});
  return true;
}
/* Lưu Mean/SD của lô mới thành "Dự kiến": KHÔNG đổi qcLotId của mức (lô đang dùng
   vẫn giữ nguyên, vẫn nhập QC bình thường) — chỉ ghi 1 mốc meanSdHistory đánh dấu
   planned:true để lần sau mở lại nhóm lô này vẫn thấy đúng số đã nhập
   (lotTargetSnapshot() đọc lại từ đây). Khác voidQcPoint/applyTargetPick, không
   đụng tới cấu hình đang vận hành nên không cần requireUnlockedPeriod. */
function applyPlannedTarget(t,lot,pick,note){
  if(!pick.use)return false;
  const target=t.levels.find(x=>+x.level===+lot.level);if(!target)return false;
  target.meanSdHistory=Array.isArray(target.meanSdHistory)?target.meanSdHistory:[];
  upsertLotTargetHistory(target,lot,{mean:pick.mean,sd:pick.sd,low:pick.low,high:pick.high,effectiveFrom:'',effectiveTo:'',source:'mfg',planned:true,note});
  return true;
}
async function readTargetMatrixPicks(){
  const rows=[...document.querySelectorAll('.target-row')],picked=[];
  for(const row of rows){
    if(row.dataset.locked==='1')continue;
    const use=row.querySelector('.tm-use'),testId=row.dataset.test,lot=state.qcLots.find(x=>x.id===row.dataset.lot);if(!lot)continue;if(!use.checked){picked.push({testId,lot,use:false});continue;}
    const meanRaw=row.querySelector('.tm-mean').value.trim(),lowRaw=row.querySelector('.tm-low').value.trim(),highRaw=row.querySelector('.tm-high').value.trim(),sdRaw=row.querySelector('.tm-sd').value.trim();
    let mean=meanRaw===''?null:parseFloat(meanRaw),low=lowRaw===''?null:parseFloat(lowRaw),high=highRaw===''?null:parseFloat(highRaw),sd=sdRaw===''?null:parseFloat(sdRaw);
    const fromLimits=QCCore.targetFromLimits(low,high);
    if(fromLimits){if(!Number.isFinite(mean))mean=fromLimits.mean;if(!Number.isFinite(sd)||sd<=0)sd=fromLimits.sd;}
    const fromTarget=QCCore.limitsFromTarget(mean,sd);
    if(fromTarget&&lowRaw===''&&highRaw===''){low=fromTarget.low;high=fromTarget.high;}
    if(!Number.isFinite(mean)){await infoDialog('Các xét nghiệm được chọn phải có trung bình mục tiêu hợp lệ.');return null;}
    if((lowRaw!==''&&!Number.isFinite(low))||(highRaw!==''&&!Number.isFinite(high))){await infoDialog('Giới hạn dưới/trên phải là số hợp lệ.');return null;}
    if((lowRaw!==''||highRaw!=='')&&(!Number.isFinite(low)||!Number.isFinite(high)||high<=low)){await infoDialog('Nếu nhập giới hạn, cần nhập đủ giới hạn dưới và trên; giới hạn trên phải lớn hơn giới hạn dưới.');return null;}
    if(sdRaw!==''&&(!Number.isFinite(sd)||sd<=0)){await infoDialog('Độ lệch chuẩn phải là số lớn hơn 0.');return null;}
    if((sd==null||!Number.isFinite(sd))&&Number.isFinite(low)&&Number.isFinite(high))sd=(high-low)/4; // ±2SD only — xác nhận theo thực tế PXN, các lô QC đang dùng không ghi khoảng ±3SD
    if(!Number.isFinite(sd)||sd<=0){await infoDialog('Các xét nghiệm được chọn cần có SD, hoặc có đủ giới hạn dưới/trên để app ước tính SD theo ±2SD.');return null;}
    picked.push({testId,lot,use:true,mean,low,high,sd});
  }
  return picked;
}
async function saveTargetMatrix(){
  if(!requireAdmin())return;
  const panel=state.qcPanels.find(x=>x.id===manageTargetPanel),group=state.lotGroups.find(x=>x.id===manageTargetGroup),groupLots=targetGroupLots(group);if(!panel){await infoDialog('Chọn Panel QC.');return;}if(!group||!groupLots.length){await infoDialog('Chọn nhóm lô QC.');return;}
  const picked=await readTargetMatrixPicks();if(!picked)return;
  const overwrites=picked.filter(pick=>{
    if(!pick.use)return false;
    const t=state.tests.find(x=>x.id===pick.testId),same=t&&t.levels.find(x=>+x.level===+pick.lot.level);
    return same&&((same.qcLotId&&same.qcLotId!==pick.lot.id)||(!same.qcLotId&&same.lot&&same.lot!==pick.lot.lotNo));
  });
  if(!overwrites.length){commitTargetMatrix(picked,group,panel,'switch',[]);return;}
  targetSwitchCtx={panel,group,picked,overwrites};
  openTargetSwitchModal();
}
function openTargetSwitchModal(){
  const {group,overwrites}=targetSwitchCtx||{};if(!group)return;
  const names=[...new Set(overwrites.map(pick=>(state.tests.find(t=>t.id===pick.testId)||{}).name).filter(Boolean))].join(', ');
  openModal(`<div class="modal">
    <div class="modal-h"><h3>Áp dụng nhóm lô ${esc(group.name)}?</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="hint">${overwrites.length} dòng (${esc(names)}) hiện đang dùng một nhóm lô khác. Chọn cách áp dụng Mean/SD vừa nhập:</div>
      <div class="hint" style="margin-top:10px"><b>Chuyển qua nhóm lô này</b>: áp dụng ngay cho các dòng trên, nhóm lô đang dùng trước đó sẽ được đánh dấu "Đã dừng" (vẫn xem/nhập được nếu cần, không bị khóa).</div>
      <div class="hint" style="margin-top:6px"><b>Dự kiến</b>: chỉ lưu lại Mean/SD đã nhập cho nhóm lô mới, chưa áp dụng — nhóm lô đang dùng vẫn tiếp tục như bình thường.</div>
    </div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn ghost" onclick="resolveTargetSwitch('planned')">Dự kiến</button><button class="btn teal" onclick="resolveTargetSwitch('switch')">Chuyển qua nhóm lô này</button></div>
  </div>`);
}
function resolveTargetSwitch(mode){
  const ctx=targetSwitchCtx;closeModal();targetSwitchCtx=null;if(!ctx)return;
  commitTargetMatrix(ctx.picked,ctx.group,ctx.panel,mode,ctx.overwrites);
}
function commitTargetMatrix(picked,group,panel,mode,overwrites){
  const effectiveFrom=isoToday(),note='Cập nhật Mean/SD',overwriteKeys=new Set((overwrites||[]).map(o=>o.testId+'|'+o.lot.level));
  const stoppedGroupIds=new Set();
  let count=0;
  picked.forEach(pick=>{
    const t=state.tests.find(x=>x.id===pick.testId);if(!t)return;
    const isOverwrite=overwriteKeys.has(pick.testId+'|'+pick.lot.level);
    if(isOverwrite&&mode==='planned'){if(applyPlannedTarget(t,pick.lot,pick,note+' (dự kiến)'))count++;return;}
    if(isOverwrite&&mode==='switch'){
      const same=t.levels.find(x=>+x.level===+pick.lot.level),oldGroup=same&&same.qcLotId?groupsOfLot(same.qcLotId)[0]:null;
      if(oldGroup&&oldGroup.id!==group.id)stoppedGroupIds.add(oldGroup.id);
    }
    if(applyTargetPick(t,pick.lot,pick,effectiveFrom,note))count++;
  });
  if(mode==='switch'&&count){
    stoppedGroupIds.forEach(id=>{const g=state.lotGroups.find(x=>x.id===id);if(g){g.status='stopped';g.stoppedAt=effectiveFrom;}});
    // Không gán group.status='active': "Đang hoạt động" được tính thẳng từ dữ liệu thật
    // (lotGroupInUse trong qc-domain.js) để không bao giờ lệch với thực tế xét nghiệm đang dùng lô nào.
    delete group.status;delete group.stoppedAt;
  }else if(mode==='planned'&&overwriteKeys.size&&count){
    group.status='planned';
  }
  logAct('Cập nhật Mean/SD',`${targetPanelLabel()} · ${group.name} · ${count} dòng${mode==='planned'?' (dự kiến)':''}`,'Mean/SD');save();rerender();
}
function openQcHistoryDetail(tid,level,lotNo=''){
  const t=state.tests.find(x=>x.id===tid),l=t&&t.levels.find(x=>+x.level===+level);if(!t||!l)return;
  const hist=(l.meanSdHistory||[]).filter(h=>!lotNo||(h.lot||'')===lotNo||(!h.lot&&(l.lot||'')===lotNo));
  const histRows=hist.length?hist.map(h=>`<tr><td><b>${esc(h.lot||lotNo||'—')}</b></td><td class="num">${fmt(h.mean)}</td><td class="num">${h.low!=null?fmt(h.low):'—'}</td><td class="num">${h.high!=null?fmt(h.high):'—'}</td><td class="num">${fmt(h.sd,3)}</td><td>${h.effectiveFrom?vnDate(h.effectiveFrom):'Không giới hạn'} → ${h.effectiveTo?vnDate(h.effectiveTo):'Không giới hạn'}</td><td>${h.source==='lab'?'PXN':'NSX'}</td></tr>`).join(''):'';
  const pts=(state.data[tid]||[]).filter(p=>+p.level===+level&&(!lotNo||(p.lot||'')===lotNo)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.runId||'').localeCompare(String(b.runId||''),'vi',{numeric:true}));
  const ptRows=pts.map(p=>{const mean=Number.isFinite(+p.qcMean)?+p.qcMean:+l.mean,sd=Number.isFinite(+p.qcSd)&&+p.qcSd>0?+p.qcSd:+l.sd,z=sd?(+p.val-mean)/sd:NaN,abs=Math.abs(z),lv=abs>3?'Loại bỏ':abs>2?'Cảnh báo':'Đạt',cls=abs>3?'rej':abs>2?'warn':'ok',staff=pointStaff(p);return `<tr><td>${vnDate(p.date)}</td><td>${esc(p.runId||'—')}</td><td class="num">${fmt(p.val)}</td><td class="num">${Number.isFinite(z)?(z>=0?'+':'')+fmt(z)+'s':'—'}</td><td class="num">${fmt(mean)}</td><td class="num">${fmt(sd,3)}</td><td><span class="tag ${cls}">${lv}</span></td><td>${esc(staff.code||'—')}</td></tr>`;}).join('');
  openModal(`<div class="modal rcfg-history-detail-modal"><div class="modal-h"><div><h3>${esc(t.name)} · Mức ${level}${lotNo?' · Lô '+esc(lotNo):''}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <h4>Mean/SD đã dùng</h4>${histRows?`<table class="history-detail-table"><thead><tr><th>Lô QC</th><th class="num">Mean</th><th class="num">Giới hạn dưới</th><th class="num">Giới hạn trên</th><th class="num">SD</th><th>Hiệu lực</th><th>Nguồn</th></tr></thead><tbody>${histRows}</tbody></table>`:emptyState('Chưa có mốc Mean/SD','Không tìm thấy lịch sử Mean/SD cho lô này.')}
    <h4 style="margin-top:18px">Điểm QC đã nhập (${pts.length})</h4>${ptRows?`<table class="history-detail-table"><thead><tr><th>Ngày</th><th>Lần chạy</th><th class="num">Giá trị</th><th class="num">Z</th><th class="num">Mean lúc nhập</th><th class="num">SD lúc nhập</th><th>Kết luận nhanh</th><th>NV</th></tr></thead><tbody>${ptRows}</tbody></table>`:emptyState('Chưa có điểm QC','Không có điểm QC nào khớp với lô/mức này.')}</div><div class="modal-f"><button class="btn teal" onclick="closeModal()">Đóng</button></div></div>`);
}
async function openConfigPanel(id=''){
  if(!state.tests.length){await infoDialog('Hãy tạo xét nghiệm trước khi tạo Panel QC.');setManageTab('assays');return;}
  if(!state.instruments.length){await infoDialog('Hãy tạo máy xét nghiệm trước khi tạo Panel QC.');setManageTab('instruments');return;}
  const p=state.qcPanels.find(x=>x.id===id)||{testIds:[],instrumentId:state.instruments[0]&&state.instruments[0].id,active:true};
  const instruments=state.instruments.map(i=>`<option value="${i.id}" ${i.id===p.instrumentId?'selected':''}>${esc(i.name)}${i.model?' · '+esc(i.model):''}</option>`).join('');
  const panelTestRows=(instrumentId,selected=[])=>state.tests.filter(t=>t.instrumentId===instrumentId).map(t=>`<label><input class="cfg-panel-test" type="checkbox" value="${t.id}" ${selected.includes(t.id)?'checked':''}><span><b>${esc(t.name)}</b><small>${esc(instrumentName(t.instrumentId,t.machine))} · ${esc(t.unit||'Chưa có đơn vị')}</small></span></label>`).join('')||'<div class="empty" style="padding:14px">Máy này chưa có xét nghiệm.</div>';
  openModal(`<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${id?'Sửa Panel QC':'Tạo Panel QC'}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="grid2"><div><label>Tên Panel QC</label><input id="cfgPanelName" value="${escAttr(p.name||'')}" placeholder="VD: Sinh hóa AU5800"></div><div><label>Máy xét nghiệm</label><select id="cfgPanelInstrument" onchange="renderConfigPanelTests()">${instruments}</select></div></div>
    <label>Chọn xét nghiệm trong panel</label><div id="cfgPanelTests" class="group-lot-picker assay-group-picker">${panelTestRows(p.instrumentId,p.testIds||[])}</div>
    <label>Ghi chú</label><textarea id="cfgPanelNote">${esc(p.note||'')}</textarea>
    <label class="rcfg-check"><input id="cfgPanelActive" type="checkbox" ${p.active!==false?'checked':''}> Panel đang sử dụng</label></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="saveConfigPanel('${id}')">Lưu Panel QC</button></div></div>`);
}
function renderConfigPanelTests(){
  const root=document.getElementById('cfgPanelTests'),instrumentId=document.getElementById('cfgPanelInstrument').value;
  if(!root)return;
  const rows=state.tests.filter(t=>t.instrumentId===instrumentId).map(t=>`<label><input class="cfg-panel-test" type="checkbox" value="${t.id}"><span><b>${esc(t.name)}</b><small>${esc(instrumentName(t.instrumentId,t.machine))} · ${esc(t.unit||'Chưa có đơn vị')}</small></span></label>`).join('');
  root.innerHTML=rows||'<div class="empty" style="padding:14px">Máy này chưa có xét nghiệm.</div>';
}
async function saveConfigPanel(id){
  if(!requireAdmin())return;
  const name=QCCore.cleanText(document.getElementById('cfgPanelName').value).trim(),instrumentId=document.getElementById('cfgPanelInstrument').value,testIds=[...document.querySelectorAll('.cfg-panel-test:checked')].map(x=>x.value);if(!name){await infoDialog('Nhập tên Panel QC.');return;}if(!instrumentId){await infoDialog('Chọn máy xét nghiệm.');return;}if(!testIds.length){await infoDialog('Chọn ít nhất một xét nghiệm.');return;}
  if(testIds.some(testId=>(state.tests.find(t=>t.id===testId)||{}).instrumentId!==instrumentId)){await infoDialog('Panel QC chỉ được chứa xét nghiệm thuộc máy đã chọn.');return;}
  if(state.qcPanels.some(x=>x.id!==id&&x.instrumentId===instrumentId&&sameText(x.name,name))){await infoDialog('Panel QC này đã tồn tại trên máy đã chọn.');return;}
  const data={name,instrumentId,testIds,note:QCCore.cleanText(document.getElementById('cfgPanelNote').value,5000),active:document.getElementById('cfgPanelActive').checked},old=state.qcPanels.find(x=>x.id===id);if(old)Object.assign(old,data);else state.qcPanels.push({id:uid(),...data});
  logAct(old?'Cập nhật Panel QC':'Thêm Panel QC',`${name} · ${testIds.length} xét nghiệm`,'Panel QC');closeModal();save();rerender();
}
async function deleteConfigPanel(id){if(!requireAdmin())return;const p=state.qcPanels.find(x=>x.id===id);if(!p)return;if(state.lotTransitions.some(x=>x.panelId===id)){await infoDialog('Panel này đang có lịch sử chuyển tiếp lô. Hãy xóa/chuyển các dòng chuyển tiếp trước.');return;}if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa Panel QC',message:`Xóa Panel QC ${p.name}?`,detail:'Các xét nghiệm vẫn được giữ nguyên.',confirmLabel:'Xóa Panel QC',cancelLabel:'Hủy'}))return;state.qcPanels=state.qcPanels.filter(x=>x.id!==id);logAct('Xóa Panel QC',p.name,'Panel QC');save();rerender();}
async function deleteLotTransition(id){if(!requireAdmin())return;const tr=state.lotTransitions.find(x=>x.id===id);if(!tr)return;if(transitionSwitchesLot(tr)){await infoDialog('Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không nên xóa trực tiếp. Nếu nhập sai, hãy tạo hồ sơ chuyển tiếp mới hoặc chỉnh nhóm lô/Mean-SD thủ công.');return;}if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa dòng chuyển tiếp lô',message:'Xóa dòng chuyển tiếp lô này?',confirmLabel:'Xóa',cancelLabel:'Hủy'}))return;state.lotTransitions=state.lotTransitions.filter(x=>x.id!==id);syncLotDepletionFromTransitions();logAct('Xóa chuyển tiếp lô',`${lotLabel(tr.fromLotId)} → ${lotLabel(tr.toLotId)}`,'Chuyển tiếp lô');save();rerender();}
async function openLotTransitionV2(id=''){
  if(!state.qcPanels.length){await infoDialog('Hãy tạo Panel QC trước khi tạo chuyển tiếp lô.');setManageTab('panels');return;}
  if(state.qcLots.length<2){await infoDialog('Cần ít nhất 2 lô QC để tạo chuyển tiếp.');setManageTab('lots');return;}
  const tr=state.lotTransitions.find(x=>x.id===id)||{panelId:state.qcPanels[0]&&state.qcPanels[0].id,fromLotId:'',toLotId:'',startDate:isoToday(),status:'planned',approvedBy:'',approvedAt:''};
  const panels=`<option value="">— Chọn Panel QC —</option>`+state.qcPanels.map(p=>`<option value="${p.id}" ${p.id===tr.panelId?'selected':''}>${esc(p.name)} · ${esc(instrumentName(p.instrumentId))}</option>`).join('');
  const lotOptions=selected=>`<option value="">— Chọn lô QC —</option>`+state.qcLots.filter(l=>!l.depleted||l.id===selected).map(l=>{const to=l.depleted?lotTransitionToNo(l.id):'';return `<option value="${l.id}" ${l.id===selected?'selected':''}>${esc(l.lotNo)} · Mức ${l.level}${l.exp?' · HSD '+vnDate(l.exp):''}${l.depleted?' · '+(to?'đã chuyển tiếp qua lô '+to:'đã hết QC'):''}</option>`;}).join('');
  openModal(`<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${id?'Sửa hồ sơ chuyển lô':'Tạo hồ sơ chuyển lô'}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <label>Panel QC áp dụng</label><select id="cfgTransPanel">${panels}</select>
    <div class="grid2"><div><label>Lô cũ</label><select id="cfgTransFrom">${lotOptions(tr.fromLotId)}</select></div><div><label>Lô mới</label><select id="cfgTransTo">${lotOptions(tr.toLotId)}</select></div></div>
    <div class="grid2"><div><label>Ngày bắt đầu (dd/mm/yyyy)</label>${dateBox('cfgTransStart',tr.startDate||'')}</div><div><label>Trạng thái</label><select id="cfgTransStatus"><option value="planned" ${tr.status==='planned'?'selected':''}>Dự kiến</option><option value="active" ${tr.status==='active'||tr.status==='completed'?'selected':''}>Đang chạy song song</option><option value="accepted" ${tr.status==='accepted'?'selected':''}>Chấp nhận lô mới</option><option value="rejected" ${tr.status==='rejected'?'selected':''}>Không chấp nhận</option></select></div></div></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="saveLotTransitionV2('${id}')">Lưu hồ sơ</button></div></div>`);
}
async function saveLotTransitionV2(id){
  if(!requireAdmin())return;
  const panelId=document.getElementById('cfgTransPanel').value,fromLotId=document.getElementById('cfgTransFrom').value,toLotId=document.getElementById('cfgTransTo').value;if(!panelId){await infoDialog('Chọn Panel QC.');return;}if(!fromLotId||!toLotId||fromLotId===toLotId){await infoDialog('Chọn lô cũ và lô mới khác nhau.');return;}
  const fromLot=state.qcLots.find(l=>l.id===fromLotId),toLot=state.qcLots.find(l=>l.id===toLotId);if(!fromLot||!toLot){await infoDialog('Không tìm thấy lô QC đã chọn.');return;}if(+fromLot.level!==+toLot.level){await infoDialog('Lô cũ và lô mới phải cùng mức QC để chuyển tiếp.');return;}
  if(state.lotTransitions.some(x=>x.id!==id&&x.panelId===panelId&&x.fromLotId===fromLotId&&x.toLotId===toLotId)){await infoDialog('Chuyển tiếp lô này đã tồn tại.');return;}
  const status=document.getElementById('cfgTransStatus').value,startRaw=document.getElementById('cfgTransStart').value.trim(),startDate=parseVN(startRaw);if(startRaw&&!startDate){await infoDialog('Ngày bắt đầu không hợp lệ. Dùng dạng dd/mm/yyyy.');return;}
  const old=state.lotTransitions.find(x=>x.id===id),nowFinal=['accepted','rejected'].includes(status),finalChanged=nowFinal&&(!old||old.status!==status);
  if(old&&transitionSwitchesLot(old)&&status!=='accepted'){await infoDialog('Hồ sơ đã chấp nhận lô mới và đã áp dụng vào nhóm lô/Mean-SD, không thể đổi ngược trạng thái.');return;}
  const data={panelId,fromLotId,toLotId,startDate:startDate||isoToday(),status,criteria:'',conclusion:'',approvedBy:finalChanged?userName():(old&&old.approvedBy||''),approvedAt:finalChanged?new Date().toISOString():(old&&old.approvedAt||''),note:''};
  if(status==='accepted'&&finalChanged){const check=inspectAcceptedLotTransition(data);if(!check.rows.length){await infoDialog('Panel đã chọn không có xét nghiệm nào đang sử dụng lô cũ. Hãy kiểm tra lại Panel và lô chuyển tiếp.');return;}if(check.missing.length){await infoDialog(`Chưa thể chấp nhận lô mới: ${check.missing.map(x=>x.t.name).join(', ')} chưa có Mean/SD riêng cho lô ${toLot.lotNo}. Hãy lưu Mean/SD ở chế độ “Dự kiến” trước.`);return;}}
  const tr=old?Object.assign(old,data):{id:uid(),...data};if(!old)state.lotTransitions.push(tr);
  const switched=applyAcceptedLotTransitionToConfig(tr);
  const wasDepleted=!!(state.qcLots.find(l=>l.id===fromLotId)||{}).depleted;
  syncLotDepletionFromTransitions();
  const nowDepleted=!!(state.qcLots.find(l=>l.id===fromLotId)||{}).depleted;
  if(nowDepleted&&!wasDepleted)logAct('Khóa lô đã hết',`${lotLabel(fromLotId)} · chuyển tiếp sang ${lotLabel(toLotId)}`,'Lô QC');
  else if(!nowDepleted&&wasDepleted)logAct('Mở lại lô QC',lotLabel(fromLotId),'Lô QC');
  if(switched)logAct('Áp dụng chuyển tiếp lô',`${panelName(panelId)} · ${lotLabel(fromLotId)} → ${lotLabel(toLotId)} · ${switched} xét nghiệm`,'Chuyển tiếp lô');
  logAct(old?'Cập nhật chuyển lô QC':'Thêm chuyển lô QC',`${panelName(panelId)}: ${lotLabel(fromLotId)} → ${lotLabel(toLotId)} · ${transitionStatusLabelV2(status).text}`,'Chuyển tiếp lô');clearDerived();closeModal();save();rerender();
}
async function openConfigGroup(id=''){
  if(!state.qcLots.length){await infoDialog('Hãy tạo lô QC trước khi tạo nhóm lô.');setManageTab('lots');return;}
  const g=state.lotGroups.find(x=>x.id===id)||{lotIds:[]};
  const levels=[...new Set(state.qcLots.map(l=>+l.level).filter(Number.isFinite))].sort((a,b)=>a-b);
  const levelLayout=levels.length>=3?'levels-3plus':levels.length===2?'levels-2':'levels-1';
  const lotColumns=levels.map(level=>`<div class="lot-level-col"><div class="lot-level-title">Mức ${level}</div>${state.qcLots.filter(l=>+l.level===level).map(l=>{const inGroup=(g.lotIds||[]).includes(l.id),lock=l.depleted&&!inGroup,to=l.depleted?lotTransitionToNo(l.id):'',depletedLabel=l.depleted?(to?'đã chuyển tiếp qua lô '+to:'đã hết QC'):'';return `<label class="${l.depleted?'lot-opt-depleted':''}"${lock?` title="Lô ${escAttr(depletedLabel)} — không thể chọn"`:''}><input class="cfg-group-lot" type="checkbox" value="${l.id}" ${inGroup?'checked':''} ${lock?'disabled':''} onchange="suggestConfigGroupName()"><span><b>${esc(l.lotNo)}</b><small>HSD ${l.exp?vnDate(l.exp):'chưa có'}${l.depleted?' · '+depletedLabel:''}</small></span></label>`;}).join('')}</div>`).join('');
  openModal(`<div class="modal rcfg-modal rcfg-group-modal ${levelLayout}"><div class="modal-h"><div><h3>${id?'Sửa nhóm lô':'Tạo nhóm lô mới'}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <label>Chọn các lô QC</label>
    <div class="lot-level-picker">${lotColumns}</div>
    <label>Tên nhóm lô</label><input id="cfgGroupName" value="${escAttr(g.name||'')}" placeholder="Tự động: 1102/1103">
    <label>Ghi chú</label><textarea id="cfgGroupNote">${esc(g.note||'')}</textarea></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="saveConfigGroup('${id}')">Lưu nhóm lô</button></div></div>`);
}
function suggestConfigGroupName(){const ids=[...document.querySelectorAll('.cfg-group-lot:checked')].map(x=>x.value),name=ids.map(id=>(state.qcLots.find(l=>l.id===id)||{}).lotNo).filter(Boolean).join('/'),el=document.getElementById('cfgGroupName');if(el)el.value=name;}
async function saveConfigGroup(id){
  if(!requireAdmin())return;
  const lotIds=[...document.querySelectorAll('.cfg-group-lot:checked')].map(x=>x.value);if(lotIds.length<2){await infoDialog('Một nhóm lô cần chọn ít nhất 2 lô QC.');return;}
  const name=QCCore.cleanText(document.getElementById('cfgGroupName').value).trim()||lotIds.map(lid=>(state.qcLots.find(l=>l.id===lid)||{}).lotNo).filter(Boolean).join('/');if(!name){await infoDialog('Nhập tên nhóm lô.');return;}
  if(state.lotGroups.some(x=>x.id!==id&&(sameText(x.name,name)||sameIdSet(x.lotIds,lotIds)))){await infoDialog('Nhóm lô này đã tồn tại hoặc trùng danh sách lô.');return;}
  const data={name,lotIds,note:QCCore.cleanText(document.getElementById('cfgGroupNote').value,5000),active:true};
  const old=state.lotGroups.find(x=>x.id===id);if(old)Object.assign(old,data);else state.lotGroups.push({id:uid(),...data});
  const sigmaSync=reconcileSigmaLevelsWithLotGroups(),syncNote=sigmaSync.pruned?` · đã xóa ${sigmaSync.pruned} dữ liệu mức Sigma không còn trong nhóm`:'';
  logAct(old?'Cập nhật nhóm lô':'Thêm nhóm lô',name+syncNote,'Nhóm lô');closeModal();save();rerender();
}
async function deleteConfigGroup(id){if(!requireAdmin())return;const g=state.lotGroups.find(x=>x.id===id);if(!g)return;if(state.tests.some(t=>(t.levels||[]).some(l=>l.qcLotId&&(g.lotIds||[]).includes(l.qcLotId)))){await infoDialog('Nhóm lô này đang được gán Mean/SD cho xét nghiệm. Hãy đổi nhóm/lô ở thẻ Mean/SD trước khi xóa nhóm.');return;}if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa nhóm lô',message:`Xóa nhóm lô ${g.name}?`,detail:'Các lô QC bên trong vẫn được giữ nguyên.',confirmLabel:'Xóa nhóm lô',cancelLabel:'Hủy'}))return;state.lotGroups=state.lotGroups.filter(x=>x.id!==id);logAct('Xóa nhóm lô',g.name,'Nhóm lô');save();rerender();}
/* Dừng luồng vận hành của nhóm: giữ nguyên liên kết lô/Mean-SD để bảo toàn lịch sử và
   có thể kích hoạt lại, nhưng isOperationalLotGroup() sẽ loại nhóm khỏi Nhập QC cùng
   mọi luồng vận hành mới. Chiều ngược lại đi qua activateLotGroup(). */
function toggleLotGroupStatus(id){
  if(!requireAdmin())return;
  const g=state.lotGroups.find(x=>x.id===id);if(!g||g.active===false||g.status==='stopped'||g.status==='planned')return;
  g.status='stopped';g.stoppedAt=isoToday();
  logAct('Dừng nhóm lô',g.name,'Nhóm lô');
  save();rerender();
}
/* Kích hoạt một nhóm lô đang "Đã dừng"/"Dự kiến"/"Chưa dùng": với mỗi xét nghiệm có mức
   khớp lô trong nhóm và CHƯA đang gắn đúng lô đó, lấy Mean/SD đã biết của chính lô này —
   ưu tiên bản "Dự kiến" vừa lưu (lotTargetSnapshot đọc cả hai) — rồi áp làm cấu hình
   sống (applyTargetPick), y hệt bấm "Chuyển qua nhóm lô này" ở màn Mean/SD nhưng làm
   thẳng từ thẻ nhóm lô, không cần mở lại màn hình và tick từng dòng. Nhóm đang gắn
   trước đó (nếu khác) được đánh dấu "Đã dừng"; xét nghiệm không có Mean/SD nào cho lô
   này (chưa từng nhập) thì bỏ qua, không báo lỗi — chỉ áp được cho phần đã biết số liệu.
   Nếu nhóm thực ra đã đang được dùng thật rồi (chỉ còn dính nhãn "Đã dừng"/"Dự kiến" cũ,
   vd bấm nhầm hoặc dữ liệu cũ) thì không có gì để áp cả — chỉ gỡ nhãn cho khớp thực tế. */
async function activateLotGroup(id){
  if(!requireAdmin())return;
  const g=state.lotGroups.find(x=>x.id===id);if(!g||g.active===false)return;
  const lots=(g.lotIds||[]).map(lid=>state.qcLots.find(l=>l.id===lid)).filter(Boolean);
  if(!lots.length)return;
  if(!await confirmDialog({title:'Kích hoạt nhóm lô',message:`Áp dụng Mean/SD của nhóm lô ${g.name} cho các xét nghiệm liên quan và chuyển sang dùng nhóm này?`,confirmLabel:'Áp dụng',cancelLabel:'Hủy',danger:false}))return;
  const effectiveFrom=isoToday(),note='Kích hoạt nhóm lô',stoppedGroupIds=new Set();
  let count=0;
  state.tests.forEach(t=>{
    lots.forEach(lot=>{
      const target=(t.levels||[]).find(x=>+x.level===+lot.level);if(!target||target.qcLotId===lot.id)return;
      const snap=lotTargetSnapshot(t,lot.level,lot.id,lot.lotNo);
      if(!snap||!Number.isFinite(+snap.mean)||!Number.isFinite(+snap.sd)||+snap.sd<=0)return;
      if(target.qcLotId){const oldGroup=groupsOfLot(target.qcLotId)[0];if(oldGroup&&oldGroup.id!==g.id)stoppedGroupIds.add(oldGroup.id);}
      if(applyTargetPick(t,lot,{use:true,mean:snap.mean,low:snap.low,high:snap.high,sd:snap.sd},effectiveFrom,note))count++;
    });
  });
  if(!count){
    if(lotGroupInUse(g)){delete g.status;delete g.stoppedAt;save();rerender();await infoDialog(`Nhóm lô ${g.name} đã đang được xét nghiệm dùng thật, chỉ gỡ nhãn cũ.`,{type:'success'});return;}
    await infoDialog('Nhóm lô này chưa có Mean/SD (dự kiến hoặc lịch sử) cho xét nghiệm nào để áp dụng. Vào màn Mean/SD để nhập trước.');return;
  }
  stoppedGroupIds.forEach(gid=>{const og=state.lotGroups.find(x=>x.id===gid);if(og){og.status='stopped';og.stoppedAt=effectiveFrom;}});
  delete g.status;delete g.stoppedAt;
  logAct('Kích hoạt nhóm lô',`${g.name} · ${count} dòng`,'Nhóm lô');
  save();rerender();
  await infoDialog(`Đã áp dụng Mean/SD cho ${count} dòng và chuyển sang nhóm lô ${g.name}.`,{type:'success'});
}
function openConfigLot(id=''){
  const l=state.qcLots.find(x=>x.id===id)||{level:1,active:true};
  openModal(`<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${id?'Sửa thông tin lô QC':'Tạo lô QC mới'}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="grid2"><div><label>Số lô</label><input id="cfgLotNo" value="${escAttr(l.lotNo||'')}" placeholder="VD: 1234UE"></div><div><label>Mức QC</label><select id="cfgLotLevel">${[1,2,3,4,5,6].map(n=>`<option ${+l.level===n?'selected':''}>${n}</option>`).join('')}</select></div></div>
    <div class="grid2"><div><label>Mô tả</label><input id="cfgLotDescription" value="${escAttr(l.description||'')}" placeholder="VD: Acusera Assayed Chemistry Control"></div><div><label>Nhà cung cấp</label><input id="cfgLotSupplier" value="${escAttr(l.supplier||'')}" placeholder="Randox"></div></div>
    <div class="grid2"><div><label>Ngày mở (dd/mm/yyyy)</label>${dateBox('cfgLotOpened',l.opened||'')}</div><div><label>Hạn sử dụng (dd/mm/yyyy)</label>${dateBox('cfgLotExp',l.exp||'')}</div></div>
    <label>Ghi chú</label><textarea id="cfgLotNote">${esc(l.note||'')}</textarea></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="saveConfigLot('${id}')">Lưu lô</button></div></div>`);
}
async function saveConfigLot(id){
  if(!requireAdmin())return;
  const lotNo=QCCore.cleanText(document.getElementById('cfgLotNo').value).trim();if(!lotNo){await infoDialog('Nhập số lot.');return;}
  const level=+document.getElementById('cfgLotLevel').value||1,openedRaw=document.getElementById('cfgLotOpened').value.trim(),expRaw=document.getElementById('cfgLotExp').value.trim(),opened=parseVN(openedRaw),exp=parseVN(expRaw);
  if(openedRaw&&!opened){await infoDialog('Ngày mở không hợp lệ. Dùng dạng dd/mm/yyyy.');return;}if(expRaw&&!exp){await infoDialog('Hạn sử dụng không hợp lệ. Dùng dạng dd/mm/yyyy.');return;}
  const old=state.qcLots.find(x=>x.id===id);
  if(old&&+old.level!==level&&state.tests.some(t=>t.levels.some(x=>x.qcLotId===id))){await infoDialog('Lô QC đang gắn với xét nghiệm nên không thể đổi mức QC. Hãy bỏ gán lô trong Mean/SD trước.');return;}
  if(state.qcLots.some(x=>x.id!==id&&+x.level===level&&sameText(x.lotNo,lotNo))){await infoDialog('Số lô QC này đã tồn tại ở cùng mức QC.');return;}
  const oldLotNo=old&&old.lotNo||'',oldLevel=old?+old.level:level;
  const data={lotNo,level,description:QCCore.cleanText(document.getElementById('cfgLotDescription').value),supplier:QCCore.cleanText(document.getElementById('cfgLotSupplier').value),program:old&&old.program||'',opened,exp,note:QCCore.cleanText(document.getElementById('cfgLotNote').value,5000),active:true};
  const lot=old||{id:uid()};Object.assign(lot,data);if(!old)state.qcLots.push(lot);
  state.tests.forEach(t=>t.levels.filter(x=>x.qcLotId===lot.id).forEach(x=>{x.level=data.level;x.lot=data.lotNo;x.exp=data.exp;(x.meanSdHistory||[]).filter(h=>h.qcLotId===lot.id).forEach(h=>{h.lot=data.lotNo;});}));
  const renamedPoints=old?renameLotAcrossPoints(oldLevel,oldLotNo,data.lotNo):0;
  logAct(old?'Cập nhật lô QC':'Thêm lô QC',`${data.lotNo} · Mức ${data.level}`+(renamedPoints?` · Đã cập nhật ${renamedPoints} điểm QC cũ theo số lô mới`:''),'Lô QC');closeModal();save();rerender();
}
/* Điểm QC lưu số lô dạng CHUỖI TĨNH chụp lúc nhập (p.lot), không tham chiếu qcLotId —
   mọi bộ lọc "điểm của lô này" (pointsForLot/operationalLotPoints/lotPointsByNo) so
   khớp đúng chuỗi đó với l.lot hiện hành. Đổi số lô (saveConfigLot) mà không cập nhật
   lại điểm cũ sẽ khiến chúng "biến mất" khỏi Nhập QC/Westgard/Sigma: không khớp lô
   hiện tại (chuỗi đã đổi) mà cũng không hiện ở "lô cũ" (không có hồ sơ chuyển tiếp nào
   giữa 2 tên gọi của CÙNG một lô — previousLotSeries chỉ đi theo lotTransitions). Chỉ
   cascade khi số lô THẬT SỰ đổi, quét toàn bộ state.data vì lô có thể dùng chung cho
   nhiều xét nghiệm (panel) và có thể còn nằm trong lịch sử của xét nghiệm không còn
   gắn lô này nữa. Tách hàm riêng (không đọc DOM) để test trực tiếp được qua sandbox. */
function renameLotAcrossPoints(oldLevel,oldLotNo,newLotNo){
  if(!oldLotNo||oldLotNo===newLotNo)return 0;
  let renamed=0;
  Object.keys(state.data||{}).forEach(testId=>{
    (state.data[testId]||[]).filter(p=>+p.level===+oldLevel&&(p.lot||'')===oldLotNo).forEach(p=>{p.lot=newLotNo;renamed++;});
  });
  return renamed;
}
/* Lô đã "hết QC" qua chuyển tiếp ĐÃ CHẤP NHẬN không còn test nào trỏ qcLotId vào nó
   (đã chuyển hết sang lô mới) nên guard "đang gắn với xét nghiệm" bên dưới không chặn
   được — nhưng phần xóa vẫn lọc bỏ luôn hồ sơ lotTransitions tham chiếu lô này, tức âm
   thầm xóa mất chính hồ sơ chuyển tiếp mà deleteLotTransition() đã CHỦ Ý từ chối xóa
   trực tiếp (vì đã áp dụng vào cấu hình/Mean-SD, có giá trị lịch sử/audit). Chặn thêm
   ở đây cho nhất quán với bảo vệ đó — chỉ chặn hồ sơ đã chấp nhận, không chặn hồ sơ
   dự kiến/đang chạy song song/không chấp nhận (những hồ sơ đó vốn xóa trực tiếp được). */
async function deleteConfigLot(id){if(!requireAdmin())return;const l=state.qcLots.find(x=>x.id===id);if(!l)return;if(state.tests.some(t=>t.levels.some(x=>x.qcLotId===id))){await infoDialog('Lô QC này đang được gắn với xét nghiệm. Hãy đổi lô trong xét nghiệm trước.');return;}if(state.lotTransitions.some(x=>(x.fromLotId===id||x.toLotId===id)&&transitionSwitchesLot(x))){await infoDialog('Lô QC này có hồ sơ chuyển tiếp đã CHẤP NHẬN (đã áp dụng vào cấu hình/Mean-SD). Không thể xóa lô trực tiếp — nếu thực sự cần, hãy xử lý hồ sơ chuyển tiếp đó trước.');return;}if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa lô QC',message:`Xóa lô QC ${l.lotNo}?`,confirmLabel:'Xóa lô QC',cancelLabel:'Hủy'}))return;state.qcLots=state.qcLots.filter(x=>x.id!==id);state.lotGroups.forEach(g=>g.lotIds=(g.lotIds||[]).filter(x=>x!==id));state.lotTransitions=state.lotTransitions.filter(x=>x.fromLotId!==id&&x.toLotId!==id);logAct('Xóa lô QC',l.lotNo,'Lô QC');save();rerender();}
function openConfigInstrument(id=''){
  const i=state.instruments.find(x=>x.id===id)||{active:true};
  openModal(`<div class="modal rcfg-modal"><div class="modal-h"><div><h3>${id?'Sửa máy xét nghiệm':'Thêm máy xét nghiệm'}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="grid2"><div><label>Tên hiển thị</label><input id="cfgInstName" value="${escAttr(i.name||'')}" placeholder="VD: AU5800-01"></div><div><label>Khoa / Khu vực</label><input id="cfgInstSection" value="${escAttr(i.section||'')}" placeholder="Hóa sinh"></div></div>
    <div class="grid2"><div><label>Nhà sản xuất</label><input id="cfgInstMfr" value="${escAttr(i.manufacturer||'')}" placeholder="Beckman Coulter"></div><div><label>Số sê-ri</label><input id="cfgInstSerial" value="${escAttr(i.serial||'')}"></div></div>
    <label class="rcfg-check"><input id="cfgInstActive" type="checkbox" ${i.active!==false?'checked':''}> Máy đang hoạt động</label></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="saveConfigInstrument('${id}')">Lưu máy xét nghiệm</button></div></div>`);
}
async function saveConfigInstrument(id){
  if(!requireAdmin())return;
  const name=QCCore.cleanText(document.getElementById('cfgInstName').value).trim();if(!name){await infoDialog('Nhập tên máy.');return;}
  if(state.instruments.some(x=>x.id!==id&&sameText(x.name,name))){await infoDialog('Tên máy xét nghiệm này đã tồn tại.');return;}
  const data={name,section:QCCore.cleanText(document.getElementById('cfgInstSection').value),manufacturer:QCCore.cleanText(document.getElementById('cfgInstMfr').value),serial:QCCore.cleanText(document.getElementById('cfgInstSerial').value),active:document.getElementById('cfgInstActive').checked};
  const old=state.instruments.find(x=>x.id===id);if(old){Object.assign(old,data);state.tests.filter(t=>t.instrumentId===id).forEach(t=>t.machine=name);}else state.instruments.push({id:uid(),...data});
  state.machines=[...new Set(state.instruments.map(x=>x.name))];logAct(old?'Cập nhật máy':'Thêm máy xét nghiệm',name,'Máy xét nghiệm');closeModal();save();rerender();
}
async function deleteConfigInstrument(id){if(!requireAdmin())return;const i=state.instruments.find(x=>x.id===id);if(!i)return;if(state.tests.some(t=>t.instrumentId===id)){await infoDialog('Máy này đang được gắn với xét nghiệm. Hãy chuyển xét nghiệm sang máy khác trước.');return;}if(state.qcPanels.some(p=>p.instrumentId===id)){await infoDialog('Máy này đang được gắn với Panel QC. Hãy chuyển hoặc xóa Panel QC trước.');return;}if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa máy xét nghiệm',message:`Xóa máy ${i.name}?`,confirmLabel:'Xóa máy',cancelLabel:'Hủy'}))return;state.instruments=state.instruments.filter(x=>x.id!==id);state.machines=state.instruments.map(x=>x.name);logAct('Xóa máy xét nghiệm',i.name,'Máy xét nghiệm');save();rerender();}
function defaultAssayLevels(){
  const levels=[...new Set(state.qcLots.map(l=>+l.level).filter(Number.isFinite))].sort((a,b)=>a-b);
  return (levels.length?levels:[1]).map(level=>({level,mean:null,sd:null,low:null,high:null,rangeK:2,mfgMean:null,mfgSd:null,applied:'mfg',meanSdHistory:[]}));
}
function configAssayTeaRefs(){return typeof effectiveTeaRefs==='function'?effectiveTeaRefs():REFTESTS.map(([name,unit,clia,ricos,section])=>[name,unit,clia,ricos,section,null,teaAnalyteMeta(name).analyteId]);}
function configAssayRefRecord(name,analyteId=''){const key=teaAnalyteKey(name);return(state.teaRefs||[]).find(r=>analyteId&&r.analyteId===analyteId)||(state.teaRefs||[]).find(r=>teaAnalyteKey(r.name)===key)||null;}
function configAssayNaming(ref){return teaAnalyteMeta(ref&&ref[0],ref&&configAssayRefRecord(ref[0],ref[6]));}
function configAssayFindRef(value){const key=typeof searchText==='function'?searchText(value):teaAnalyteKey(value);if(!key)return null;return configAssayTeaRefs().find(ref=>{const naming=configAssayNaming(ref);return[ref[0],naming.displayName,naming.standardName,naming.abbreviation,...naming.aliases].some(v=>(typeof searchText==='function'?searchText(v):teaAnalyteKey(v))===key);})||null;}
function configAssaySuggestionInput(value){
  const ref=configAssayFindRef(value),keyEl=document.getElementById('cfgAssayTeaRefKey'),sourceEl=document.getElementById('cfgAssayTeaSource');
  if(!ref){if(keyEl)keyEl.value='';if(sourceEl)sourceEl.value='';return;}
  const naming=configAssayNaming(ref),tea=ref[2]!=null?ref[2]:ref[3],source=ref[2]!=null?'clia':ref[3]!=null?'ricos':'';
  document.getElementById('cfgAssayName').value=naming.displayName||ref[0];if(keyEl)keyEl.value=ref[6]||ref[0];if(sourceEl)sourceEl.value=source;
  document.getElementById('cfgAssayUnit').value=ref[1]||'';document.getElementById('cfgAssayTea').value=tea==null?'':tea;
}
function openConfigAssay(id=''){
  if(!state.instruments.length){openConfigInstrument();return;}
  const t=state.tests.find(x=>x.id===id)||{levels:defaultAssayLevels(),active:true};
  // Trình duyệt tự chọn option đầu tiên khi không có option nào đánh dấu "selected" (test mới,
  // chưa gán máy) — lấy đúng máy đó làm mặc định để Khoa/Khu vực điền sẵn ngay từ đầu, thay vì
  // chỉ điền khi onchange bắn ra (không bắn nếu máy đầu tiên người dùng chọn trùng máy mặc định).
  const defaultInst=state.instruments.find(i=>i.id===(t.instrumentId||''))||state.instruments[0];
  const instruments=state.instruments.map(i=>`<option value="${i.id}" ${i.id===(t.instrumentId||'')?'selected':''} data-section="${escAttr(i.section||'')}">${esc(i.name)}${i.model?' · '+esc(i.model):''}</option>`).join('');
  /* Chỉ coi là "đã ghi đè" khi ruleActions[rule] có giá trị hợp lệ tường minh — nếu
     chưa (rỗng/thiếu), mặc định chọn "Theo cấu hình chung" thay vì âm thầm chốt cứng
     giá trị đang áp dụng lúc mở modal. Nếu không, MỌI lần lưu xét nghiệm (kể cả chỉ
     đổi tên/đơn vị, không đụng phần luật) sẽ ghi cứng cả 13 luật theo cấu hình chung
     tại đúng thời điểm đó — làm xét nghiệm hết đồng bộ với cấu hình chung mãi mãi mà
     không có cảnh báo nào, dù người dùng chưa từng chủ ý ghi đè. */
  const ruleRows=WG_RULES.map(rule=>{const explicit=t&&t.ruleActions&&['inactive','alert','reject'].includes(t.ruleActions[rule])?t.ruleActions[rule]:'',scope=t&&t.ruleScopes&&['within','across','both'].includes(t.ruleScopes[rule])?t.ruleScopes[rule]:'';return `<div class="assay-rule-row"><b>${rule}</b><select class="cfg-assay-rule" data-rule="${rule}" aria-label="Hành động ${rule}"><option value="" ${explicit===''?'selected':''}>Theo cấu hình chung</option><option value="inactive" ${explicit==='inactive'?'selected':''}>Không dùng</option><option value="alert" ${explicit==='alert'?'selected':''}>Cảnh báo</option><option value="reject" ${explicit==='reject'?'selected':''}>Loại bỏ</option></select><select class="cfg-assay-scope" data-rule="${rule}" aria-label="Phạm vi ${rule}"><option value="" ${scope===''?'selected':''}>Phạm vi SOP khuyến nghị</option><option value="within" ${scope==='within'?'selected':''}>Chỉ trong từng mức</option><option value="across" ${scope==='across'?'selected':''}>Chỉ chéo mức/lần chạy</option><option value="both" ${scope==='both'?'selected':''}>Cả hai phạm vi</option></select></div>`;}).join('');
  const cusum=testCusumConfig(t);
  const initialRef=configAssayTeaRefs().find(r=>t.analyteId&&r[6]===t.analyteId)||configAssayFindRef(t.name||t.displayName||''),initialNaming=initialRef?configAssayNaming(initialRef):null,initialName=initialNaming&&initialNaming.displayName||t.displayName||t.name||'',initialSource=initialRef?(initialRef[2]!=null?'clia':initialRef[3]!=null?'ricos':''):(t.teaSource||'');
  const teaOptions=configAssayTeaRefs().map(ref=>({ref,naming:configAssayNaming(ref)})).sort((a,b)=>String(a.ref[4]||'').localeCompare(String(b.ref[4]||''),'vi')||String(a.naming.displayName||'').localeCompare(String(b.naming.displayName||''),'vi')).map(({ref,naming})=>{const extra=[naming.standardName!==naming.displayName?naming.standardName:'',naming.abbreviation,...naming.aliases.filter(x=>x!==ref[0]&&x!==naming.displayName&&x!==naming.standardName).slice(0,3),ref[1],ref[4]].filter(Boolean).join(' · ');return`<option value="${escAttr(naming.displayName||ref[0])}" label="${escAttr(extra)}"></option>`;}).join('');
  openModal(`<div class="modal rcfg-modal rcfg-assay-modal"><div class="modal-h"><div><h3>${id?'Sửa xét nghiệm':'Thêm xét nghiệm'}</h3></div><button class="modal-close" onclick="closeModal()">✕</button></div><div class="modal-b">
    <div class="assay-main-grid"><div><label>Chọn / tìm xét nghiệm</label><input id="cfgAssayName" list="cfgAssayTeaSuggestions" autocomplete="off" value="${escAttr(initialName)}" placeholder="Gõ tên, viết tắt hoặc bí danh..." oninput="configAssaySuggestionInput(this.value)"><datalist id="cfgAssayTeaSuggestions">${teaOptions}</datalist><input id="cfgAssayTeaRefKey" type="hidden" value="${escAttr(initialRef&&(initialRef[6]||initialRef[0])||'')}"><input id="cfgAssayTeaSource" type="hidden" value="${escAttr(initialSource)}"></div><div><label>Máy xét nghiệm</label><select id="cfgAssayInstrument" onchange="const o=this.selectedOptions[0];const e=document.getElementById('cfgAssaySection');if(e)e.value=o?o.dataset.section||'':''">${instruments}</select></div><div><label>Khoa / Khu vực</label><input id="cfgAssaySection" value="${escAttr(t.section||(defaultInst&&defaultInst.section)||'')}" placeholder="VD: Điện giải"></div></div>
    <div class="assay-detail-grid"><div><label>Đơn vị</label><input id="cfgAssayUnit" value="${escAttr(t.unit||'')}"></div><div><label>Phương pháp</label><input id="cfgAssayMethod" value="${escAttr(t.method||'')}"></div><div><label>TEa %</label><input id="cfgAssayTea" type="number" step="any" value="${escAttr(t.tea||'')}"></div><div><label>Hóa chất</label><input id="cfgAssayReagent" value="${escAttr(t.reagent||'')}"></div></div>
    <div class="config-form-section"><b>Luật Westgard riêng cho xét nghiệm</b><span>Chọn hành động và phạm vi áp dụng. “SOP khuyến nghị” tránh tính trùng trong từng mức và chéo mức.</span></div><div class="assay-rule-grid">${ruleRows}</div>
    <div class="config-form-section"><b>Giám sát xu hướng CUSUM</b><span>Biểu đồ tham khảo bắt trôi/shift kéo dài sớm hơn Westgard — không đổi trạng thái đạt/loại QC</span></div>
    <label class="rcfg-check"><input id="cfgAssayCusumOn" type="checkbox" ${cusum.on?'checked':''}> Bật biểu đồ CUSUM cho xét nghiệm này</label>
    <div class="grid2"><div><label>Ngưỡng tích lũy k (SD)</label><input id="cfgAssayCusumK" type="number" step="0.1" min="0.1" value="${escAttr(cusum.k)}"></div><div><label>Ngưỡng cảnh báo h (SD)</label><input id="cfgAssayCusumH" type="number" step="0.5" min="0.5" value="${escAttr(cusum.h)}"></div></div>
    <label class="rcfg-check"><input id="cfgAssayClosed" type="checkbox" ${t.closed?'checked':''}> Đóng QC Test, không dùng cho cấu hình mới</label></div>
    <div class="modal-f"><button class="btn ghost" onclick="closeModal()">Hủy</button><button class="btn teal" onclick="saveConfigAssay('${id}')">Lưu xét nghiệm</button></div></div>`);
}
async function saveConfigAssay(id){
  if(!requireAdmin())return;
  const existing=state.tests.find(x=>x.id===id),enteredName=QCCore.cleanText(document.getElementById('cfgAssayName').value).trim(),refKey=document.getElementById('cfgAssayTeaRefKey').value,ref=refKey?configAssayTeaRefs().find(r=>r[6]===refKey||teaAnalyteKey(r[0])===teaAnalyteKey(refKey)):null,naming=ref?configAssayNaming(ref):null,name=ref?ref[0]:enteredName,analyteId=ref?ref[6]:(existing&&existing.analyteId||'local-'+String(existing&&existing.id||uid()).replace(/[^A-Za-z0-9_-]/g,'').slice(0,73)),instrumentId=document.getElementById('cfgAssayInstrument').value,inst=state.instruments.find(x=>x.id===instrumentId);if(!name||!inst){await infoDialog('Chọn hoặc nhập tên xét nghiệm và chọn máy.');return;}
  if(state.tests.some(x=>x.id!==id&&x.instrumentId===instrumentId&&(x.analyteId&&x.analyteId===analyteId||sameText(x.name,name)))){await infoDialog('Xét nghiệm này đã tồn tại trên máy đã chọn.');return;}
  const oldInstrumentId=existing&&existing.instrumentId,levels=existing?[...(existing.levels||[])]:defaultAssayLevels();
  const tea=parseFloat(document.getElementById('cfgAssayTea').value)||0;if(tea<0){await infoDialog('TEa không được âm.');return;}
  const ruleActions=Object.fromEntries([...document.querySelectorAll('.cfg-assay-rule')].map(el=>[el.dataset.rule,el.value]));
  const ruleScopes=Object.fromEntries([...document.querySelectorAll('.cfg-assay-scope')].map(el=>[el.dataset.rule,el.value]));
  const cusumK=parseFloat(document.getElementById('cfgAssayCusumK').value),cusumH=parseFloat(document.getElementById('cfgAssayCusumH').value);
  const cusum={on:document.getElementById('cfgAssayCusumOn').checked,k:Number.isFinite(cusumK)&&cusumK>0?cusumK:0.5,h:Number.isFinite(cusumH)&&cusumH>0?cusumH:4};
  const data={analyteId,name,displayName:naming?naming.displayName:enteredName,standardName:naming?naming.standardName:existing&&existing.standardName||enteredName,abbreviation:naming?naming.abbreviation:existing&&existing.abbreviation||'',aliases:naming?naming.aliases:existing&&existing.aliases||[enteredName],matrix:naming?naming.matrix:existing&&existing.matrix||'',instrumentId,machine:inst.name,section:QCCore.cleanText(document.getElementById('cfgAssaySection').value).trim()||inst.section||'',unit:QCCore.cleanText(document.getElementById('cfgAssayUnit').value),method:QCCore.cleanText(document.getElementById('cfgAssayMethod').value),reagent:QCCore.cleanText(document.getElementById('cfgAssayReagent').value),reagentSupplier:existing&&existing.reagentSupplier||'',temperature:existing&&existing.temperature||0,genNo:existing&&existing.genNo||'',performanceLimit:existing&&existing.performanceLimit||'',tea,teaSource:ref?(document.getElementById('cfgAssayTeaSource').value||existing&&existing.teaSource||'ricos'):existing&&existing.teaSource||'ricos',levels,ruleActions,ruleScopes,cusum,closed:document.getElementById('cfgAssayClosed').checked,active:true,sgTracked:existing?!!existing.sgTracked:false};
  if(existing){Object.assign(existing,data);if(oldInstrumentId&&oldInstrumentId!==instrumentId)state.qcPanels.forEach(p=>{if(p.instrumentId!==instrumentId)p.testIds=(p.testIds||[]).filter(testId=>testId!==id);});logAct('Cập nhật xét nghiệm',`${inst.name} · ${levels.length} mức QC`,name);}else{const test={id:uid(),...data};state.tests.push(test);state.data[test.id]=[];logAct('Thêm xét nghiệm',`${inst.name} · ${levels.length} mức QC`,name);}
  closeModal();save();rerender();
}
async function delTest(id){if(!requireAdmin())return;const t=state.tests.find(x=>x.id===id);if(!t)return;if(!await confirmDialog({kicker:'Thao tác không thể hoàn tác',title:'Xóa xét nghiệm',message:`Xóa xét nghiệm ${t.name} và toàn bộ dữ liệu QC?`,detail:'Toàn bộ điểm QC, Westgard và Sigma của xét nghiệm này sẽ mất, không thể khôi phục.',confirmLabel:'Xóa xét nghiệm',cancelLabel:'Hủy'}))return;state.tests=state.tests.filter(t=>t.id!==id);state.qcPanels.forEach(p=>p.testIds=(p.testIds||[]).filter(testId=>testId!==id));state.assayGroups.forEach(g=>g.testIds=(g.testIds||[]).filter(testId=>testId!==id));delete state.data[id];if(selTest===id)selTest=state.tests[0]&&state.tests[0].id||null;if(entrySel&&entrySel.testId===id)entrySel=null;logAct('Xóa test/lô','Xóa xét nghiệm và toàn bộ dữ liệu QC',t.name);save();rerender();}
