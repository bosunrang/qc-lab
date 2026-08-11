/* ===== MANAGEMENT PAGE ROUTES ===== */
function manageSearchSet(v){
  manageQ=v;
  scheduleSearchRender(manageSearchSet,renderManageBody,'manageSearch');
}
function manageMatch(values){const q=searchText(manageQ);return !q||values.some(v=>searchText(v).includes(q));}
function manageSearchPlaceholder(){
  const map={
    instruments:'Tìm theo tên máy, hãng, số sê-ri...',
    assays:'Tìm theo tên xét nghiệm, máy, đơn vị, phương pháp, hóa chất, TEa...',
    panels:'Tìm theo tên panel QC, máy và xét nghiệm...',
    lots:'Tìm theo số lô, nhóm lô QC...',
    targets:'Tìm theo tên xét nghiệm...',
    transitions:'Tìm theo panel QC, lô cũ/mới...',
    history:'Tìm theo xét nghiệm, mức, lô QC...',
    tearefs:'Tìm theo tên xét nghiệm, nhóm, đơn vị...'
  };
  return map[manageTab]||'';
}
function sameText(a,b){return searchText(a)===searchText(b);}
function sameIdSet(a,b){const A=[...new Set(a||[])].sort(),B=[...new Set(b||[])].sort();return A.length===B.length&&A.every((x,i)=>x===B[i]);}
function groupsOfLot(id){return state.lotGroups.filter(g=>(g.lotIds||[]).includes(id));}
function lotGroupLabels(id){const groups=groupsOfLot(id);return groups.length?groups.map(g=>g.name).join(', '):'Chưa thuộc nhóm';}
function instrumentName(id,fallback=''){const x=state.instruments.find(i=>i.id===id);return x?x.name:(fallback||'Chưa gán máy');}
function panelName(id){const x=state.qcPanels.find(p=>p.id===id);return x?x.name:'Chưa chọn Panel QC';}
function lotLabel(id){const l=state.qcLots.find(x=>x.id===id);return l?`${l.lotNo} · Mức ${l.level}`:'Chưa chọn lô';}
function lotTransitionToNo(lotId){const tr=(state.lotTransitions||[]).find(x=>x.fromLotId===lotId&&transitionSwitchesLot(x));if(!tr)return'';const to=state.qcLots.find(l=>l.id===tr.toLotId);return to?to.lotNo:'';}
function lotStatus(l){if(l&&l.depleted){const to=lotTransitionToNo(l.id);return{text:to?`Đã chuyển tiếp qua lô ${to}`:'Đã chuyển tiếp',cls:'rej'};}const d=daysToExp(l.exp);return d==null?{text:'Chưa có HSD',cls:'none'}:d<0?{text:'Hết hạn',cls:'rej'}:d<=30?{text:`Còn ${d} ngày`,cls:'warn'}:{text:'Đang hoạt động',cls:'ok'};}
function transitionStatusLabelV2(s){return s==='active'?{text:'Đang chạy song song',cls:'warn'}:s==='accepted'?{text:'Chấp nhận lô mới',cls:'ok'}:s==='rejected'?{text:'Không chấp nhận',cls:'rej'}:{text:'Dự kiến',cls:'none'};}
function manageShell(body){
  const histCount=state.tests.reduce((n,t)=>n+(t.levels||[]).reduce((m,l)=>m+Math.max(1,(l.meanSdHistory||[]).length),0),0);
  const items=[['instruments','Máy xét nghiệm'],['assays','Danh mục xét nghiệm'],['panels','Panel QC'],['lots','Lô & Nhóm QC'],['targets','Mean/SD'],['transitions','Chuyển tiếp lô'],['history','Lịch sử dữ liệu'],['tearefs','Bảng TEa tham chiếu']];
  return `<div class="config-shell"><aside class="config-shell-nav" aria-label="Danh mục cấu hình"><div class="rcfg-title">CẤU HÌNH CHUNG</div>${items.map(x=>`<button class="${manageTab===x[0]?'on':''}" onclick="setManageTab('${x[0]}')"><b>${x[1]}</b><small>${x[0]==='lots'?state.qcLots.length+' / '+state.lotGroups.length:x[0]==='panels'?state.qcPanels.length:x[0]==='targets'?state.tests.reduce((n,t)=>n+t.levels.filter(l=>l.qcLotId).length,0):x[0]==='history'?histCount:x[0]==='transitions'?state.lotTransitions.length:x[0]==='assays'?state.tests.length:x[0]==='instruments'?state.instruments.length:x[0]==='tearefs'?effectiveTeaRefs().length:''}</small></button>`).join('')}</aside><section class="config-shell-main">${body}</section></div>`;
}
function manageToolbar(title,sub,action,label){
  const ph=manageSearchPlaceholder(),search=ph?`<input id="manageSearch" placeholder="${escAttr(ph)}" value="${escAttr(manageQ)}" oninput="manageSearchSet(this.value)">`:'';
  return `<div class="rcfg-toolbar"><div><h2>${title}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><div class="rcfg-tools">${search}${action?btn('＋ '+label,action,'teal'):''}</div></div>`;
}
function manageLots(){
  const rows=state.qcLots.filter(l=>manageMatch([l.lotNo,l.description,l.supplier,l.program,lotGroupLabels(l.id),l.level,l.exp])).map(l=>{const used=state.tests.reduce((n,t)=>n+t.levels.filter(x=>x.qcLotId===l.id).length,0),s=lotStatus(l);return `<tr><td><b>${esc(l.lotNo)}</b>${(l.description||l.program)?`<div class="hint">${esc(l.description||l.program)}</div>`:''}</td><td><span class="pill">M${l.level}</span></td><td>${l.exp?vnDate(l.exp):'—'}</td><td><span class="tag ${s.cls}">${s.text}</span></td><td class="num">${used}</td><td><div class="lot-row-actions">${btn('Sửa',`openConfigLot('${l.id}')`,'ghost sm')}${btn('Xóa',`deleteConfigLot('${l.id}')`,'danger sm')}</div></td></tr>`;}).join('');
  const groupRows=state.lotGroups.filter(g=>manageMatch([g.name,g.note,...(g.lotIds||[]).map(id=>(state.qcLots.find(l=>l.id===id)||{}).lotNo)])).map(g=>{
    const lots=(g.lotIds||[]).map(id=>state.qcLots.find(l=>l.id===id)).filter(Boolean),archived=g.active===false;
    /* archived (g.active===false): nhóm đã lưu trữ. stopped/planned: giữ liên kết lô để
       xem lịch sử hoặc kích hoạt lại nhưng bị khóa khỏi Nhập QC. lotGroupInUse() chỉ cho
       biết nhóm còn được cấu hình Mean/SD tham chiếu hay không; trạng thái vận hành thật
       được isOperationalLotGroup() quyết định. */
    const inUse=lotGroupInUse(g);
    const statusTag=archived?{cls:'rej',text:'Đã lưu trữ'}:g.status==='stopped'?{cls:'rej',text:'Đã dừng'}:g.status==='planned'?{cls:'warn',text:'Dự kiến'}:inUse?{cls:'ok',text:'Đang hoạt động'}:{cls:'none',text:'Chưa dùng'};
    const toggleBtn=archived?'':(g.status==='stopped'||g.status==='planned'||!inUse)
      ?btn('Kích hoạt',`activateLotGroup('${g.id}')`,'teal sm')
      :btn('Dừng',`toggleLotGroupStatus('${g.id}')`,'ghost sm btn-stop-tint');
    return `<div class="lot-group-card${archived?' lot-opt-depleted':''}"><div class="lot-group-card-h"><div><b>${esc(g.name)}</b><small>${esc(g.note||'Nhóm lô để gán Mean/SD theo Panel')}</small></div><span class="tag ${statusTag.cls}">${statusTag.text}</span></div><div class="lot-group-chipline">${lots.map(l=>`<span class="pill">${esc(l.lotNo)} · M${l.level}</span>`).join('')||'<span class="hint">Chưa chọn lô</span>'}</div><div class="lot-group-actions">${btn('Sửa nhóm',`openConfigGroup('${g.id}')`,'ghost sm')}${btn('Mean/SD',`openTargetMatrix('','${g.id}')`,'ghost sm')}${toggleBtn}${btn('Xóa',`deleteConfigGroup('${g.id}')`,'danger sm')}</div></div>`;}).join('');
  return manageToolbar('Lô & Nhóm QC','Quản lý từng lô và nhóm lô QC.')+
  `<div class="lot-config-grid">
    <div class="panel rcfg-list lot-config-left">
      <div class="rcfg-panel-h"><h3>Lô QC</h3>${btn('Thêm lô QC','openConfigLot()','teal sm')}</div>
      ${rows?`<table class="lot-table"><thead><tr><th>Số lô</th><th>Mức</th><th>Hạn dùng</th><th>Trạng thái</th><th class="num">Gán</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có lô QC','Tạo từng lô QC độc lập, sau đó nhập Mean/SD cho Panel QC.')}
    </div>
    <div class="panel rcfg-list lot-config-right">
      <div class="rcfg-panel-h"><h3>Nhóm lô QC</h3>${btn('Thêm nhóm lô','openConfigGroup()','teal sm')}</div>
      ${groupRows?`<div class="lot-group-list">${groupRows}</div>`:emptyState('Chưa có nhóm lô','Chọn các lô QC đã tạo để ghép thành một nhóm, ví dụ 1101/1102.')}
    </div>
  </div>`;
}
function manageInstruments(){
  const rows=state.instruments.filter(i=>manageMatch([i.name,i.manufacturer,i.model,i.serial,i.section])).map(i=>{const n=state.tests.filter(t=>t.instrumentId===i.id).length;return `<tr><td><b>${esc(i.name)}</b><div class="hint">${esc(i.section||'Chưa phân khoa')}</div></td><td>${esc(i.manufacturer||'—')}</td><td>${esc(i.serial||'—')}</td><td class="num">${n}</td><td><span class="tag ${i.active?'ok':'none'}">${i.active?'Đang hoạt động':'Ngừng hoạt động'}</span></td><td><div class="manage-actions">${btn('Sửa',`openConfigInstrument('${i.id}')`,'ghost sm')}${btn('Xóa',`deleteConfigInstrument('${i.id}')`,'danger sm')}</div></td></tr>`;}).join('');
  return manageToolbar('Máy xét nghiệm','Quản lý máy xét nghiệm, hãng và số sê-ri.',"openConfigInstrument()",'Thêm máy xét nghiệm')+`<div class="panel rcfg-list">${rows?`<table class="instrument-table"><thead><tr><th>Máy xét nghiệm</th><th>Nhà sản xuất</th><th>Số sê-ri</th><th class="num">Xét nghiệm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có máy xét nghiệm','Thêm máy trước khi cấu hình xét nghiệm.')}</div>`;
}
function managePanels(){
  const rows=state.qcPanels.filter(p=>manageMatch([p.name,p.note,instrumentName(p.instrumentId),...(p.testIds||[]).map(id=>(state.tests.find(t=>t.id===id)||{}).name)])).map(p=>{const tests=(p.testIds||[]).map(id=>state.tests.find(t=>t.id===id)).filter(Boolean);return `<tr><td><b>${esc(p.name)}</b></td><td>${esc(instrumentName(p.instrumentId))}</td><td>${tests.map(t=>`<span class="pill">${esc(testDisplayName(t))}</span>`).join('')||'—'}</td><td class="num">${tests.length}</td><td><span class="tag ${p.active!==false?'ok':'none'}">${p.active!==false?'Đang dùng':'Tạm ngưng'}</span></td><td><div class="manage-actions">${btn('Sửa',`openConfigPanel('${p.id}')`,'ghost sm')}${btn('Xóa',`deleteConfigPanel('${p.id}')`,'danger sm')}</div></td></tr>`;}).join('');
  return manageToolbar('Panel QC','Nhóm các xét nghiệm theo từng máy để thiết lập và quản lý QC.',"openConfigPanel()",'Thêm Panel QC')+`<div class="panel rcfg-list">${rows?`<table class="panel-qc-table"><thead><tr><th>Tên panel</th><th>Máy xét nghiệm</th><th>Xét nghiệm trong panel</th><th class="num">Số vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có Panel QC','Tạo Panel QC trước, sau đó nhập Mean/SD theo nhóm lô trong thẻ Mean/SD.')}</div>`;
}
function targetPanelOptions(){return state.qcPanels.map(p=>`<option value="${p.id}" ${p.id===manageTargetPanel?'selected':''}>${esc(p.name)} · ${esc(instrumentName(p.instrumentId))}</option>`).join('');}
function manageTransitionsV2(){
  const rows=state.lotTransitions.filter(tr=>manageMatch([panelName(tr.panelId),lotLabel(tr.fromLotId),lotLabel(tr.toLotId),tr.startDate,tr.status,tr.approvedBy])).map(tr=>{const s=transitionStatusLabelV2(tr.status),to=state.qcLots.find(l=>l.id===tr.toLotId),moved=transitionSwitchesLot(tr)&&to?`<div class="hint">Đã chuyển tiếp qua lô ${esc(to.lotNo)}</div>`:'',approval=tr.approvedBy?`<div class="hint">Duyệt: ${esc(tr.approvedBy)}${tr.approvedAt?' · '+formatDateTimeVN(tr.approvedAt):''}</div>`:'';return `<tr><td><b>${esc(panelName(tr.panelId))}</b></td><td><div><b>${esc(lotLabel(tr.fromLotId))}</b></div><div class="hint">→ ${esc(lotLabel(tr.toLotId))}</div></td><td>${tr.startDate?vnDate(tr.startDate):'—'}</td><td><span class="tag ${s.cls}">${s.text}</span>${moved}${approval}</td><td><div class="manage-actions">${btn('Sửa',`openLotTransitionV2('${tr.id}')`,'ghost sm')}${btn('Xóa',`deleteLotTransition('${tr.id}')`,'danger sm')}</div></td></tr>`;}).join('');
  return manageToolbar('Chuyển tiếp lô QC','Theo dõi lô cũ, lô mới và trạng thái khi thay lô.',"openLotTransitionV2()",'Thêm hồ sơ chuyển lô')+`<div class="panel rcfg-list transition-list">${rows?`<table class="transition-table"><thead><tr><th>Panel QC</th><th>Chuyển lô</th><th>Bắt đầu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có hồ sơ chuyển lô','Tạo hồ sơ để theo dõi chuyển từ lô cũ sang lô mới.')}</div>`;
}
function targetPanelTests(){const p=state.qcPanels.find(x=>x.id===manageTargetPanel);return(p&&p.testIds||[]).map(id=>state.tests.find(t=>t.id===id)).filter(Boolean);}
function targetPanelLabel(){const p=state.qcPanels.find(x=>x.id===manageTargetPanel);return p?p.name:'Panel QC';}
function targetGroupLots(group){return(group&&group.lotIds||[]).map(id=>state.qcLots.find(l=>l.id===id)).filter(Boolean).sort((a,b)=>(+a.level)-(+b.level)||String(a.lotNo||'').localeCompare(String(b.lotNo||''),'vi',{numeric:true}));}
function targetGroupLabel(group){return group?group.name:'Chưa chọn nhóm lô';}
function groupStatusSuffix(g){return g&&g.status==='stopped'?' · Đã dừng':g&&g.status==='planned'?' · Dự kiến':'';}
function targetGroupOptions(){
  const groups=state.lotGroups.filter(g=>g.active!==false&&targetGroupLots(g).length);
  return groups.length?groups.map(g=>`<option value="${g.id}" ${g.id===manageTargetGroup?'selected':''}>${esc(targetGroupLabel(g)+groupStatusSuffix(g))}</option>`).join(''):'<option value="">Không tìm thấy nhóm lô QC phù hợp</option>';
}
function ensureTargetSelection(){
  if(!state.qcPanels.some(p=>p.id===manageTargetPanel))manageTargetPanel=state.qcPanels[0]&&state.qcPanels[0].id||'';
  const groups=state.lotGroups.filter(g=>g.active!==false&&targetGroupLots(g).length);
  if(!groups.some(g=>g.id===manageTargetGroup))manageTargetGroup=groups[0]&&groups[0].id||'';
}
function manageTargets(){
  ensureTargetSelection();
  if(!state.tests.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC để nhập Mean/SD hàng loạt.',"setManageTab('assays')",'Thêm xét nghiệm')+`<div class="panel">${emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó quay lại nhập Mean/SD theo nhóm lô.')}</div>`;
  if(!state.qcPanels.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chỉ dùng Panel QC để nhập Mean/SD hàng loạt.',"setManageTab('panels')",'Thêm Panel QC')+`<div class="panel">${emptyState('Chưa có Panel QC','Tạo Panel QC và chọn các xét nghiệm thành viên trước, sau đó quay lại nhập Mean/SD theo nhóm lô.')}</div>`;
  if(!state.qcLots.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.',"setManageTab('lots')",'Thêm lô QC')+`<div class="panel">${emptyState('Chưa có lô QC','Tạo lô QC trước, gom vào nhóm lô rồi quay lại nhập Mean/SD theo nhóm.')}</div>`;
  if(!state.lotGroups.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.',"setManageTab('lots')",'Thêm nhóm lô')+`<div class="panel">${emptyState('Chưa có nhóm lô QC','Tạo nhóm lô từ các lô QC trước, sau đó quay lại nhập Mean/SD theo nhóm.')}</div>`;
  const group=state.lotGroups.find(x=>x.id===manageTargetGroup),groupLots=targetGroupLots(group),targetLevels=[...new Set(groupLots.map(l=>+l.level).filter(Number.isFinite))].sort((a,b)=>a-b);
  if(!targetLevels.map(String).includes(String(manageTargetLevel)))manageTargetLevel=targetLevels[0]!=null?String(targetLevels[0]):'';
  const selectedLevel=Number(manageTargetLevel),levelLots=groupLots.filter(l=>+l.level===selectedLevel),levelDepletedLots=levelLots.filter(l=>l.depleted),q=searchText(manageQ),allTests=targetPanelTests(),tests=allTests.filter(t=>!q||[t.name,testDisplayName(t),t.unit,t.method,t.reagent,t.section,instrumentName(t.instrumentId,t.machine),group&&group.name,...levelLots.map(l=>l.lotNo)].some(v=>searchText(v).includes(q)));
  if(!group||!groupLots.length)return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô để nhập Mean/SD hàng loạt.')+`<div class="panel">${emptyState('Nhóm lô chưa có lô QC','Sửa nhóm lô và chọn các lô QC cần dùng trước.')}</div>`;
  const rowItems=tests.flatMap(t=>levelLots.map(lot=>({t,lot}))).filter(({t,lot})=>!lot.depleted||(t.levels||[]).some(l=>l.qcLotId===lot.id)).map(({t,lot})=>{
    const linked=(t.levels||[]).find(l=>l.qcLotId===lot.id),same=(t.levels||[]).find(l=>+l.level===+lot.level),assigned=targetConfigAssigned(same);
    const planned=!linked&&plannedTargetFor(t,lot);
    /* Khi KHÔNG phải lô đang thực sự gắn với mức, lấy Mean/SD đã lưu riêng của
       CHÍNH lô này (lotTargetSnapshot, đã bao gồm cả mốc "Dự kiến" nếu có) thay vì
       "same" (cấu hình đang live của mức, có thể đang thuộc một nhóm lô song song
       khác) — tránh hiện nhầm giá trị. */
    const cfg=linked||lotTargetSnapshot(t,lot.level,lot.id,lot.lotNo);
    return{t,lot,linked,same,assigned,planned,cfg};
  });
  const targetStats=rowItems.reduce((a,{linked,assigned,cfg})=>{if(linked)a.linked++;else if(assigned)a.other++;else a.empty++;if(!cfg||!Number.isFinite(+cfg.mean)||((!Number.isFinite(+cfg.sd)||+cfg.sd<=0)&&(!Number.isFinite(+cfg.low)||!Number.isFinite(+cfg.high)||+cfg.high<=+cfg.low)))a.missing++;return a;},{linked:0,other:0,empty:0,missing:0});
  const rows=rowItems.map(({t,lot,linked,same,assigned,planned,cfg})=>{const draft=targetRangeDraft(cfg||{}),locked=!!lot.depleted,retiredTo=locked?lotTransitionToNo(lot.id):'',checked=locked?false:(!!linked||!assigned),disabled=locked||!checked;return `<div class="target-row${locked?' target-row-locked':''}" data-test="${t.id}" data-lot="${lot.id}"${locked?' data-locked="1"':''}>
    <label class="lot-assay-check"><input class="tm-use" type="checkbox" ${checked?'checked':''} ${locked?'disabled':''} onchange="toggleTargetRow(this)"><span></span></label>
    <div class="lot-assay-name"><b>${esc(testDisplayName(t))}</b><small>${esc(t.unit||'Chưa có đơn vị')}</small></div>
    <input class="tm-mean" type="number" step="any" value="${escAttr(targetNumberText(draft.mean,t))}" placeholder="Trung bình" oninput="syncTargetRange(this,'target')" ${disabled?'disabled':''}>
    <input class="tm-low" type="number" step="any" value="${escAttr(targetNumberText(draft.low,t))}" placeholder="Giới hạn dưới" oninput="syncTargetRange(this,'limits')" ${disabled?'disabled':''}>
    <input class="tm-high" type="number" step="any" value="${escAttr(targetNumberText(draft.high,t))}" placeholder="Giới hạn trên" oninput="syncTargetRange(this,'limits')" ${disabled?'disabled':''}>
    <input class="tm-sd" type="number" step="any" value="${escAttr(targetNumberText(draft.sd,t,'stat'))}" placeholder="Độ lệch chuẩn" oninput="syncTargetRange(this,'target')" ${disabled?'disabled':''}>
    <span>${locked?`<b class="tag rej">${retiredTo?'Đã chuyển tiếp qua lô '+esc(retiredTo):'Đã chuyển tiếp'}</b>`:linked?'<b class="tag ok">Đã gán</b>':planned?'<b class="tag warn">Dự kiến</b>':assigned?`<b class="tag warn">Đang dùng ${esc(same.lot||'lô khác')}</b>`:'<b class="tag none">Chưa gán</b>'}</span>
  </div>`;}).join('');
  return manageToolbar('Mean/SD theo nhóm lô QC','Chọn Panel QC và nhóm lô, app tự đưa các xét nghiệm trong panel vào bảng Mean/SD.')+
  `<div class="panel target-matrix-panel">
    <div class="target-selector">
      <div><label>Panel QC</label><select onchange="setTargetPanel(this.value)">${targetPanelOptions()||'<option value="">Chưa có panel</option>'}</select></div>
      <div><label>Nhóm lô QC</label><select onchange="setTargetGroup(this.value)">${targetGroupOptions()}</select></div>
    </div>
    ${rowItems.length?`<div class="target-summary"><span class="ok"><b>${targetStats.linked}</b> đã gán mức này</span><span class="${targetStats.other?'warn':'none'}"><b>${targetStats.other}</b> đang dùng lô khác</span><span class="${targetStats.empty?'warn':'none'}"><b>${targetStats.empty}</b> chưa gán lô</span><span class="${targetStats.missing?'warn':'ok'}"><b>${targetStats.missing}</b> thiếu Mean/SD</span></div>`:''}
    ${rowItems.length?`<div class="target-level-toolbar"><div><b>Mức ${esc(manageTargetLevel)}</b><span class="target-level-lot">${levelLots.map(l=>esc(l.lotNo)).join(' / ')}</span></div><div class="dayseg">${targetLevels.map(level=>`<button class="${String(level)===String(manageTargetLevel)?'on':''}" onclick="setTargetLevel(${level})">Mức ${level}</button>`).join('')}</div></div>
    <div class="target-table"><div class="target-head"><span>Dùng</span><span>Xét nghiệm</span><span>Trung bình mục tiêu</span><span>Giới hạn dưới</span><span>Giới hạn trên</span><span>Độ lệch chuẩn</span><span>Trạng thái</span></div>${rows}</div>
    <div class="modal-f target-actions">${btn('Bỏ chọn tất cả','targetCheckAll(false)','ghost')}${btn('Chọn tất cả','targetCheckAll(true)','ghost')}${btn('Lưu Mean/SD mức này','saveTargetMatrix()','teal')}</div>`:(allTests.length?(levelDepletedLots.length&&levelDepletedLots.length===levelLots.length?emptyState(`Lô mức ${esc(manageTargetLevel)} đã hết QC`,`Lô ${esc(levelDepletedLots.map(l=>l.lotNo).join(', '))} (Mức ${esc(manageTargetLevel)}) trong nhóm này đã hết QC nên không nhập Mean/SD được. Hãy chọn nhóm lô khác ở ô “Nhóm lô QC” phía trên, hoặc tạo lô mới rồi lập hồ sơ chuyển tiếp lô.`):emptyState('Không tìm thấy xét nghiệm','Thử tìm theo tên xét nghiệm, máy, khoa, đơn vị hoặc lô QC.')):emptyState('Panel chưa có xét nghiệm','Sửa Panel QC và chọn các xét nghiệm thành viên trước.'))}</div>`;
}
function manageAssays(){
  const matched=state.tests.filter(t=>manageMatch([t.name,testDisplayName(t),t.unit,t.method,t.reagent,instrumentName(t.instrumentId,t.machine),t.section,t.tea]));
  const rows=matched.map((t,idx)=>`<tr><td class="num">${idx+1}</td><td><b>${esc(testDisplayName(t))}</b><div class="hint">${esc(t.method||'Chưa nhập phương pháp')} · ${esc(t.unit||'Chưa có đơn vị')}</div></td><td>${esc(instrumentName(t.instrumentId,t.machine))}<div class="hint">${esc(t.section||'Chưa gán khoa/khu vực')}</div></td><td>${esc(t.reagent||'—')}</td><td>${t.tea?esc(t.tea)+'%':'—'}</td><td><span class="tag ${t.closed?'none':'ok'}">${t.closed?'Ngưng dùng':'Đang dùng'}</span></td><td><div class="manage-actions">${btn('Sửa',`openConfigAssay('${t.id}')`,'ghost sm')}${btn('Xóa',`delTest('${t.id}')`,'danger sm')}</div></td></tr>`).join('');
  return manageToolbar('Danh mục xét nghiệm','Quản lý xét nghiệm, máy, đơn vị, phương pháp và TEa.',"openConfigAssay()",'Thêm xét nghiệm')+`<div class="panel rcfg-list">${rows?`<table class="assay-table"><thead><tr><th class="num">STT</th><th>Tên xét nghiệm</th><th>Máy xét nghiệm</th><th>Hóa chất</th><th>TEa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${rows}</tbody></table>`:emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó gán lô và Mean/SD ở các thẻ cấu hình tương ứng.')}</div>`;
}
function manageHistorySearchValues(t){
  const values=[t.name,testDisplayName(t)];
  (t.levels||[]).forEach(l=>{
    const hist=l.meanSdHistory&&l.meanSdHistory.length?l.meanSdHistory:[{qcLotId:l.qcLotId,lot:l.lot,effectiveFrom:'',effectiveTo:l.exp,source:l.applied||'mfg'}];
    hist.forEach(h=>{
      if(h.planned)return; // "Dự kiến" chưa áp dụng — không phải lịch sử thật, xem ở màn Mean/SD/Lô & Nhóm QC
      const lotObj=state.qcLots.find(x=>x.id===(h.qcLotId||l.qcLotId))||state.qcLots.find(x=>x.lotNo===(h.lot||l.lot)&&+x.level===+l.level);
      values.push(l.level,`M${l.level}`,`Mức ${l.level}`,h.lot,l.lot,lotObj&&lotObj.lotNo);
    });
  });
  return values;
}
function manageHistory(){
  const q=searchText(manageQ),matches=state.tests.filter(t=>!q||manageHistorySearchValues(t).some(v=>searchText(v).includes(q)));
  if(!state.tests.length)return manageToolbar('Lịch sử dữ liệu QC','Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.')+`<div class="panel">${emptyState('Chưa có xét nghiệm','Tạo xét nghiệm trước, sau đó cấu hình lô và Mean/SD.')}</div>`;
  if(!matches.length)return manageToolbar('Lịch sử dữ liệu QC','Chọn xét nghiệm để xem các lô, Mean/SD và thời gian hiệu lực.')+`<div class="panel">${emptyState('Không tìm thấy xét nghiệm','Thử tìm theo tên xét nghiệm.')}</div>`;
  if(!matches.some(t=>t.id===manageHistoryTest))manageHistoryTest=matches[0].id;
  const t=state.tests.find(x=>x.id===manageHistoryTest)||matches[0];
  const opts=matches.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${esc(testDisplayName(x))}</option>`).join('');
  const rows=[];
  (t.levels||[]).forEach(l=>{
    const hist=(l.meanSdHistory&&l.meanSdHistory.length?l.meanSdHistory:[{qcLotId:l.qcLotId,lot:l.lot,mean:l.mean,sd:l.sd,low:l.low,high:l.high,effectiveFrom:'',effectiveTo:l.exp,source:l.applied||'mfg'}]);
    hist.forEach(h=>{
      if(h.planned)return; // "Dự kiến" chưa áp dụng — không hiện ở lịch sử dữ liệu thật
      const lotObj=state.qcLots.find(x=>x.id===(h.qcLotId||l.qcLotId))||state.qcLots.find(x=>x.lotNo===(h.lot||l.lot)&&+x.level===+l.level);
      const lotNo=h.lot||l.lot||(lotObj&&lotObj.lotNo)||'',group=lotObj?lotGroupLabels(lotObj.id):'Chưa thuộc nhóm',pts=(state.data[t.id]||[]).filter(p=>+p.level===+l.level&&(p.lot||'')===(lotNo||''));
      rows.push({t,l,h,lotObj,lotNo,group,pts});
    });
  });
  const visibleRows=rows.filter(r=>!q||[t.name,r.l.level,`M${r.l.level}`,`Mức ${r.l.level}`,r.lotNo].some(v=>searchText(v).includes(q)));
  const html=visibleRows.sort((a,b)=>(+a.l.level)-(+b.l.level)||(a.lotNo||'').localeCompare(b.lotNo||'','vi')||String(a.h.effectiveFrom||'').localeCompare(String(b.h.effectiveFrom||''))).map(r=>{
    const range=(r.h.low!=null||r.h.high!=null)?`<div class="hint">GH ${r.h.low!=null?fmtTestValue(r.t,r.h.low):'—'} – ${r.h.high!=null?fmtTestValue(r.t,r.h.high):'—'}</div>`:'';
    const period=`${r.h.effectiveFrom?vnDate(r.h.effectiveFrom):'Không giới hạn'} → ${r.h.effectiveTo?vnDate(r.h.effectiveTo):'Không giới hạn'}`;
    return `<tr><td><span class="pill">M${r.l.level}</span></td><td><b>${esc(r.lotNo||'—')}</b><div class="hint">${esc(r.group)}</div></td><td class="num">${fmtTestValue(r.t,r.h.mean)}</td><td class="num">${r.h.low!=null?fmtTestValue(r.t,r.h.low):'—'}</td><td class="num">${r.h.high!=null?fmtTestValue(r.t,r.h.high):'—'}</td><td class="num">${fmtTestValue(r.t,r.h.sd)}</td><td>${period}</td><td><span class="tag ${r.h.source==='lab'?'warn':'ok'}">${r.h.source==='lab'?'PXN':'NSX'}</span></td><td class="num">${r.pts.length}</td><td>${btn('Chi tiết',`openQcHistoryDetail('${r.t.id}',${r.l.level},'${jsq(r.lotNo||'')}')`,'ghost sm')}</td></tr>`;
  }).join('');
  return manageToolbar('Lịch sử dữ liệu QC','Chọn một xét nghiệm để xem các lô/Mean-SD đã từng dùng.')+
  `<div class="panel target-matrix-panel">
    <div class="target-selector history-selector">
      <div><label>Xét nghiệm</label><select onchange="setHistoryTest(this.value)">${opts}</select></div>
      <div class="target-lot-info"><b>${visibleRows.length}</b><span>mốc lô/Mean-SD</span></div>
      <div class="target-lot-info"><b>${visibleRows.reduce((n,r)=>n+r.pts.length,0)}</b><span>điểm QC đã nhập</span></div>
    </div>
    <div class="rcfg-list">${html?`<table class="history-table"><thead><tr><th>Mức</th><th>Lô QC / Nhóm lô</th><th class="num">Mean</th><th class="num">Giới hạn dưới</th><th class="num">Giới hạn trên</th><th class="num">SD</th><th>Hiệu lực</th><th>Nguồn</th><th class="num">Điểm QC</th><th></th></tr></thead><tbody>${html}</tbody></table>`:(q?emptyState('Không tìm thấy mốc phù hợp','Thử tìm theo tên xét nghiệm, mức hoặc lô QC.'):emptyState('Chưa có lịch sử lô','Xét nghiệm này chưa được gán lô/Mean-SD.'))}</div>
  </div>`;
}
/* ===== Bảng TEa tham chiếu (CLIA/Ricos/chuẩn hóa PXN) sửa được trong app ===== */
const TEA_LAB_BASIS_SOURCES=[['regulation','Quy định pháp lý / CLIA / quốc gia'],['pt','Chương trình ngoại kiểm / PT'],['eflm','EFLM Biological Variation'],['ricos','Ricos / Westgard BV (nguồn cũ)'],['professional','Hiệp hội / ủy ban chuyên môn'],['other','Nguồn khác đã thẩm định']];
function teaLabBasisLabel(src){return(TEA_LAB_BASIS_SOURCES.find(x=>x[0]===src)||[])[1]||'';}
function teaRefFind(refKey){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.find(state,refKey);const k=teaRefName(refKey);return (state.teaRefs||[]).find(r=>r.analyteId===refKey)||(state.teaRefs||[]).find(r=>teaRefName(r.name)===k);}
function teaRefNumOrNull(v){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.numberOrNull(v);const n=Number(v);return String(v==null?'':v).trim()!==''&&Number.isFinite(n)&&n>0?n:null;}
function teaRefExternalChanged(row,refKey){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.externalChanged(row,refKey);const base=REFTESTS.find(r=>teaAnalyteMeta(r[0]).analyteId===refKey);return!!(row&&base&&(row.unit!==base[1]||row.clia!==base[2]||row.ricos!==base[3]||row.section!==base[4]||['cliaRule','cliaAbsolute','cliaAbsoluteUnit'].some(k=>row[k]!=null&&row[k]!=='')));}
function teaRefSourceMeta(name,src){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.sourceMeta(state,name,src);const base=TEA_SOURCE_REGISTRY[src]||{},row=teaRefFind(name),custom=row&&row.sources&&row.sources[src]||{};return{...base,...Object.fromEntries(Object.entries(custom).filter(([,v])=>String(v??'').trim()!==''))};}
function teaRefStampSource(row,src){if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.stampSource(state,row,src);const base=teaRefSourceMeta(row.name,src);row.sources=row.sources||{};row.sources[src]={...base,status:'reviewed',reviewedDate:isoToday(),reviewedBy:userName()};}
function teaRefEnsure(refKey){
  if(globalThis.TeaReferenceService)return globalThis.TeaReferenceService.ensure(state,refKey).record;
  let e=teaRefFind(refKey);
  if(!e){const src=effectiveTeaRefs().find(r=>r[6]===refKey||teaRefName(r[0])===teaRefName(refKey)),id=uid(),naming=teaAnalyteMeta(src?src[0]:refKey);e={id,analyteId:src&&src[6]||naming.analyteId||('custom-'+id),name:src?src[0]:refKey,displayName:naming.displayName,standardName:naming.standardName,abbreviation:naming.abbreviation,aliases:naming.aliases,matrix:naming.matrix,unit:src?src[1]:'',clia:src?src[2]:null,ricos:src?src[3]:null,lab:src?src[7]:null,section:src?src[4]:'',sources:{}};
    state.teaRefs=state.teaRefs||[];state.teaRefs.push(e);}
  return e;
}
/* Sửa/xóa/thêm dòng TEa tham chiếu có thể ảnh hưởng TEa% của NHIỀU xét nghiệm
   đang track Sigma cùng lúc (không chỉ xét nghiệm đang mở) — đồng bộ lại snapshot
   kỳ hiện tại của tất cả trước khi lưu, để Sigma không hiển thị TEa cũ cho tới
   khi ai đó tình cờ mở lại trang đó. */
function teaRefEdit(name,field,val){if(!requireAdmin())return;const edited=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.edit(state,name,field,val),e=edited&&edited.record||teaRefEnsure(name),before=edited?edited.before:e[field];if(!edited){e[field]=teaRefNumOrNull(val);teaRefStampSource(e,field);}logAct('Cập nhật TEa tham chiếu',`${e.name} · ${field.toUpperCase()}: ${before??'—'} → ${e[field]??'—'} · ${e.sources[field].version||'không phiên bản'}`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});rerender();}
function teaRefRemove(refKey){if(!requireAdmin())return;const row=teaRefFind(refKey),isDefault=teaRefIsDefault(refKey),removed=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.restoreOrRemove(state,refKey,isDefault);if(!removed){if(isDefault&&row&&row.lab!=null){const base=REFTESTS.find(r=>teaAnalyteMeta(r[0]).analyteId===refKey);if(base){row.name=base[0];row.unit=base[1];row.clia=base[2];row.ricos=base[3];row.section=base[4];row.sources={lab:row.sources&&row.sources.lab||{}};['cliaRule','cliaAbsolute','cliaAbsoluteUnit'].forEach(k=>delete row[k]);}}else state.teaRefs=(state.teaRefs||[]).filter(r=>r.analyteId!==refKey&&teaRefName(r.name)!==teaRefName(refKey));}logAct(isDefault?'Khôi phục TEa mặc định':'Xóa TEa tự thêm',row&&row.name||refKey,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});rerender();}
function teaSourceRegistryHtml(){return`<div class="tea-source-registry">${['clia','ricos','eflm'].map(src=>{const m=TEA_SOURCE_REGISTRY[src],status=m.status==='retired'?'Nguồn cũ':m.status==='dynamic'?'Cập nhật liên tục':'Hiện hành',tagClass=m.status==='retired'?'warn':m.status==='dynamic'?'ok':'none';return`<div class="tea-source-card ${m.status}"><div><b>${esc(m.label)}</b><span class="tag ${tagClass}">${esc(status)}</span></div><p>${esc(m.version)}${m.effectiveDate?' · hiệu lực '+vnDate(m.effectiveDate):''} · rà soát ${vnDate(m.reviewedDate)}</p><a href="${escAttr(m.url)}" target="_blank" rel="noopener">Mở nguồn chính thức</a></div>`;}).join('')}</div>`;}
function teaRefOpenAdd(){
  if(!requireAdmin())return;
  openModal(`<div class="modal"><div class="modal-h"><h3>Thêm xét nghiệm tham chiếu</h3><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div class="modal-b">
      <div class="grid2"><div><label>Tên quốc tế <span class="req">*</span></label><input id="trAddName" placeholder="VD: Creatine kinase-MB"></div><div><label>Viết tắt</label><input id="trAddAbbreviation" placeholder="VD: CK-MB"></div></div>
      <div class="grid2"><div><label>Loại mẫu (matrix)</label><input id="trAddMatrix" placeholder="VD: Serum/Plasma"></div><div></div></div>
      <div class="grid2"><div><label>Đơn vị</label><input id="trAddUnit" placeholder="U/L"></div><div><label>Nhóm</label><input id="trAddSection" placeholder="Hóa sinh"></div></div>
      <div class="grid2"><div><label>TEa CLIA %</label><input id="trAddClia" type="number" step="any"></div><div><label>TEa Ricos %</label><input id="trAddRicos" type="number" step="any"></div></div>
      <div class="hint flow-item">Mỗi xét nghiệm dùng một tên quốc tế duy nhất; viết tắt được hiển thị trong ngoặc. TEa chuẩn hóa được lập thành hồ sơ riêng sau khi thêm dòng.</div></div>
    <div class="modal-f">${btn('Hủy','closeModal()','ghost')}${btn('Thêm xét nghiệm','teaRefAddSubmit()','teal')}</div></div>`);
  setTimeout(()=>{const el=document.getElementById('trAddName');if(el)el.focus();},0);
}
async function teaRefAddSubmit(){
  if(!requireAdmin())return;
  const name=QCCore.cleanText(document.getElementById('trAddName').value,120).trim();
  if(!name){await infoDialog('Nhập tên xét nghiệm.');return;}
  const input={name,abbreviation:QCCore.cleanText(document.getElementById('trAddAbbreviation').value,40).trim(),matrix:QCCore.cleanText(document.getElementById('trAddMatrix').value,80).trim(),unit:QCCore.cleanText(document.getElementById('trAddUnit').value,40),section:QCCore.cleanText(document.getElementById('trAddSection').value,80),clia:document.getElementById('trAddClia').value,ricos:document.getElementById('trAddRicos').value},added=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.addCustomReference(state,input),e=added&&added.record||teaRefEnsure(name);if(!added){e.name=name;
    e.abbreviation=input.abbreviation;
    e.standardName=name;e.displayName=e.abbreviation&&teaRefName(e.abbreviation)!==teaRefName(name)?`${name} (${e.abbreviation})`:name;e.aliases=e.abbreviation?[e.abbreviation]:[];
    e.matrix=input.matrix;
    e.unit=input.unit;
    e.section=input.section;
    e.clia=teaRefNumOrNull(input.clia);
    e.ricos=teaRefNumOrNull(input.ricos);
    if(e.clia!=null)teaRefStampSource(e,'clia');if(e.ricos!=null)teaRefStampSource(e,'ricos');}
  logAct('Thêm TEa tham chiếu',`${e.name} · CLIA ${e.clia??'—'} · Ricos ${e.ricos??'—'}`,'Bảng TEa');
  if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save();closeModal();rerender();
}
function teaLabProfileOpen(refKey){
  if(!requireAdmin())return;const ref=effectiveTeaRefs().find(r=>r[6]===refKey||teaRefName(r[0])===teaRefName(refKey));if(!ref)return;const row=teaRefFind(refKey),meta=row&&row.sources&&row.sources.lab||{},source=row&&row.labSource||'',sourceOpts=['<option value="">— Chọn nguồn chính —</option>',...TEA_LAB_BASIS_SOURCES.map(([v,label])=>`<option value="${v}" ${source===v?'selected':''}>${esc(label)}</option>`)].join(''),effective=meta.effectiveDate||isoToday(),approvedDate=meta.reviewedDate||isoToday(),prepared=row&&row.labPreparedBy||userName(),approved=meta.reviewedBy||userName(),nextReview=row&&row.labNextReviewDate||'';
  const body=`<div class="grid2"><div><label>TEa chuẩn hóa % <span class="req">*</span></label><input id="teaLabValue" type="number" step="any" min="0" aria-label="TEa chuẩn hóa phần trăm" value="${row&&row.lab!=null?row.lab:''}"></div><div><label>Nguồn chính <span class="req">*</span></label><select id="teaLabSource" aria-label="Nguồn chính của TEa chuẩn hóa">${sourceOpts}</select></div></div>
    <div><label>Tài liệu / phiên bản / đường dẫn tham chiếu <span class="req">*</span></label><input id="teaLabReference" aria-label="Tài liệu tham chiếu TEa chuẩn hóa" value="${escAttr(meta.document||'')}" placeholder="VD: 42 CFR §493.931, hiệu lực 11/07/2024"></div>
    <div><label>Lý do lựa chọn <span class="req">*</span></label><textarea id="teaLabReason" class="tea-lab-reason" aria-label="Lý do lựa chọn TEa chuẩn hóa" rows="1" placeholder="Nêu lý do chọn nguồn và mức TEa này cho mục đích sử dụng của xét nghiệm...">${esc(meta.note||'')}</textarea></div>
    <div class="tea-lab-meta-grid tea-lab-meta-primary"><div><label>Ngày hiệu lực <span class="req">*</span></label>${dateBox('teaLabEffectiveDate',effective,'manage-date','aria-label="Ngày hiệu lực TEa chuẩn hóa"')}</div><div><label>Ngày xem xét lại</label>${dateBox('teaLabNextReviewDate',nextReview,'manage-date','aria-label="Ngày xem xét lại TEa chuẩn hóa"')}</div><div><label>Người xây dựng <span class="req">*</span></label><input id="teaLabPreparedBy" aria-label="Người xây dựng TEa chuẩn hóa" value="${escAttr(prepared)}"></div></div>
    <div class="tea-lab-meta-grid tea-lab-meta-approval"><div><label>Người phê duyệt <span class="req">*</span></label><input id="teaLabApprovedBy" aria-label="Người phê duyệt TEa chuẩn hóa" value="${escAttr(approved)}"></div><div><label>Ngày phê duyệt <span class="req">*</span></label>${dateBox('teaLabApprovedDate',approvedDate,'manage-date','aria-label="Ngày phê duyệt TEa chuẩn hóa"')}</div></div>`;
  const hasProfile=row&&row.lab!=null,remove=hasProfile?btn('Xóa TEa chuẩn hóa',`teaLabProfileRemove('${escAttr(refKey)}')`,'danger'):'';
  openModal(modalTemplate({title:hasProfile?'Sửa hồ sơ TEa chuẩn hóa':'Thêm hồ sơ TEa chuẩn hóa',body,footer:remove+btn('Hủy','closeModal()','ghost')+btn(hasProfile?'Lưu thay đổi':'Thêm hồ sơ TEa',`teaLabProfileSave('${escAttr(refKey)}')`,'teal'),cls:'tea-lab-profile-modal'}));
  setTimeout(()=>{const e=document.getElementById('teaLabValue');if(e)e.focus();},0);
}
async function teaLabProfileSave(refKey){
  if(!requireAdmin())return;const get=id=>String(document.getElementById(id)&&document.getElementById(id).value||'').trim(),value=teaRefNumOrNull(get('teaLabValue')),source=get('teaLabSource'),reference=QCCore.cleanText(get('teaLabReference'),500),reason=QCCore.cleanText(get('teaLabReason'),4000),effective=parseVN(get('teaLabEffectiveDate'))||'',nextReview=parseVN(get('teaLabNextReviewDate'))||'',prepared=QCCore.cleanText(get('teaLabPreparedBy'),120),approved=QCCore.cleanText(get('teaLabApprovedBy'),120),approvedDate=parseVN(get('teaLabApprovedDate'))||'';
  if(value==null){await infoDialog('Nhập TEa chuẩn hóa lớn hơn 0%.');return;}if(!teaLabBasisLabel(source)){await infoDialog('Chọn nguồn chính của TEa chuẩn hóa.');return;}if(reference.length<3){await infoDialog('Nhập tài liệu, phiên bản hoặc đường dẫn tham chiếu.');return;}if(reason.length<10){await infoDialog('Lý do lựa chọn cần ít nhất 10 ký tự.');return;}if(!effective||!approvedDate){await infoDialog('Nhập ngày hiệu lực và ngày phê duyệt hợp lệ.');return;}if(approvedDate>effective){await infoDialog('Ngày phê duyệt không được sau ngày hiệu lực.');return;}if(nextReview&&nextReview<effective){await infoDialog('Ngày xem xét lại không được trước ngày hiệu lực.');return;}if(!prepared||!approved){await infoDialog('Nhập người xây dựng và người phê duyệt.');return;}
  const profile={value,source,sourceLabel:teaLabBasisLabel(source),reference,reason,effective,nextReview,prepared,approved,approvedDate},saved=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.saveLabProfile(state,refKey,profile),row=saved&&saved.record||teaRefEnsure(refKey),before=saved?saved.before:row.lab;if(!saved){row.lab=value;row.labSource=source;row.labPreparedBy=prepared;row.labNextReviewDate=nextReview;row.sources=row.sources||{};row.sources.lab={...TEA_SOURCE_REGISTRY.lab,id:'lab-'+row.analyteId,version:teaLabBasisLabel(source),document:reference,effectiveDate:effective,reviewedDate:approvedDate,reviewedBy:approved,status:'reviewed',note:reason};}
  logAct(before==null?'Thiết lập TEa chuẩn hóa':'Cập nhật TEa chuẩn hóa',`${row.name} · ${before??'—'}% → ${value}% · ${teaLabBasisLabel(source)} · ${reference} · Hiệu lực ${vnDate(effective)} · Xây dựng: ${prepared} · Phê duyệt: ${approved} (${vnDate(approvedDate)})${nextReview?' · Xem xét lại '+vnDate(nextReview):''} · Lý do: ${reason}`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});closeModal();rerender();
}
async function teaLabProfileRemove(refKey){
  if(!requireAdmin())return;const row=teaRefFind(refKey);if(!row||row.lab==null)return;const ok=await confirmDialog({kicker:'TEa chuẩn hóa',title:'Xóa TEa chuẩn hóa?',message:`${teaAnalyteDisplay(row.name,row)} · ${row.lab}%`,detail:'Các kỳ Sigma cũ vẫn giữ ảnh chụp TEa đã sử dụng. Kỳ hiện tại sẽ không còn dùng nguồn TEa chuẩn hóa này.',confirmLabel:'Xóa TEa',cancelLabel:'Hủy',danger:true});if(!ok)return;const isDefault=teaRefIsDefault(refKey),removed=globalThis.TeaReferenceService&&globalThis.TeaReferenceService.removeLabProfile(state,refKey,isDefault),before=removed?removed.before:row.lab;if(!removed){['lab','labSource','labPreparedBy','labNextReviewDate'].forEach(k=>delete row[k]);if(row.sources)delete row.sources.lab;if(teaRefIsDefault(refKey)&&!teaRefExternalChanged(row,refKey))state.teaRefs=(state.teaRefs||[]).filter(r=>r!==row);}logAct('Xóa TEa chuẩn hóa',`${row.name} · ${before}%`,'Bảng TEa');if(typeof sgReconcileAllTeaSnapshots==='function')sgReconcileAllTeaSnapshots();save({clearDerived:false});closeModal();rerender();
}
function manageTeaRefs(){
  const canManage=role()==='admin',ro=canManage?'':'disabled';
  const overMap=new Map((state.teaRefs||[]).map(r=>[r.analyteId||teaAnalyteMeta(r.name,r).analyteId||teaRefName(r.name),r]));
  const rows=effectiveTeaRefs()
    .map(([name,unit,clia,ricos,section,,analyteId,lab])=>{const isDef=teaRefIsDefault(analyteId),record=overMap.get(analyteId),naming=teaAnalyteMeta(name,record),externalChanged=teaRefExternalChanged(record,analyteId);return{name,unit,clia,ricos,lab,section,analyteId,record,...naming,kind:!isDef?'custom':externalChanged?'override':record&&record.lab!=null?'lab':'default'};})
    .filter(r=>manageMatch([r.name,r.displayName,r.standardName,r.abbreviation,...r.aliases,r.matrix,r.unit,r.section]))
    .sort((a,b)=>String(a.section||'').localeCompare(String(b.section||''),'vi')||String(a.displayName||'').localeCompare(String(b.displayName||''),'vi'));
  const kindTag={default:'<span class="tag none">Mặc định</span>',override:'<span class="tag warn">Đã sửa</span>',lab:'<span class="tag ok">TEa PXN</span>',custom:'<span class="tag ok">Tự thêm</span>'};
  const body=rows.map(r=>{
    const act=!canManage?'':r.kind==='override'?btn('Khôi phục',`teaRefRemove('${escAttr(r.analyteId)}')`,'ghost sm','Khôi phục giá trị mặc định')
      :r.kind==='custom'?`<button class="x" onclick="teaRefRemove('${escAttr(r.analyteId)}')" title="Xóa xét nghiệm tự thêm">✕</button>`:'';
    const namingTitle=[r.standardName&&`Tên chuẩn: ${r.standardName}`,r.abbreviation&&`Viết tắt: ${r.abbreviation}`,r.matrix&&`Loại mẫu: ${r.matrix}`].filter(Boolean).join(' · ');
    const labButton=canManage?btn(r.lab==null?'Thêm hồ sơ':'Xem hồ sơ',`teaLabProfileOpen('${escAttr(r.analyteId)}')`,'ghost sm',r.lab==null?'Lập hồ sơ TEa chuẩn hóa':'Xem hoặc cập nhật nguồn và lý do lựa chọn'):'';
    return `<tr><td><b title="${escAttr(namingTitle)}">${esc(r.displayName||r.name)}</b></td><td>${esc(r.unit||'—')}</td><td>${esc(r.section||'—')}</td>
      <td><input class="tea-ref-value" ${ro} type="number" step="any" value="${r.clia==null?'':r.clia}" onchange="teaRefEdit('${escAttr(r.analyteId)}','clia',this.value)"></td>
      <td><input class="tea-ref-value" ${ro} type="number" step="any" value="${r.ricos==null?'':r.ricos}" onchange="teaRefEdit('${escAttr(r.analyteId)}','ricos',this.value)"></td>
      <td><div class="tea-lab-cell">${r.lab==null?'':`<b>${fmt(r.lab,2)}%</b>`}${labButton}</div></td>
      <td><div class="tea-ref-status">${kindTag[r.kind]}${act}</div></td></tr>`;
  }).join('');
  return manageToolbar('Bảng TEa tham chiếu','Tổng hợp TEa từ các nguồn tham chiếu, dùng thống nhất khi tính Sigma.',canManage?'teaRefOpenAdd()':'','Thêm xét nghiệm')+teaSourceRegistryHtml()+
    `<div class="panel rcfg-list tea-ref-panel">${rows.length?`<table class="tea-ref-table"><thead><tr><th>Xét nghiệm</th><th>Đơn vị</th><th>Nhóm</th><th>TEa CLIA %</th><th>TEa Ricos %</th><th>TEa chuẩn hóa %</th><th>Trạng thái</th></tr></thead><tbody>${body}</tbody></table>`:(searchText(manageQ)?emptyState('Không tìm thấy','Thử từ khóa khác.'):emptyState('Chưa có bảng tham chiếu','Không có xét nghiệm nào.'))}</div>`;
}
function manageView(){
  const views={lots:manageLots,panels:managePanels,targets:manageTargets,history:manageHistory,transitions:manageTransitionsV2,assays:manageAssays,instruments:manageInstruments,tearefs:manageTeaRefs};
  if(!views[manageTab])manageTab='instruments';return views[manageTab]();
}
function renderManageBody(){
  const el=document.querySelector('.config-shell-main');
  if(page!=='manage'||!el){rerender();return;}
  el.innerHTML=manageView();
}
function pageManage(){
  return headOnly('Cấu hình chung','Quản lý máy, Panel QC, lô QC, Mean/SD và luật QC')+manageShell(manageView());
}
